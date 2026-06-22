import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";

import { calculateSettlement } from "@/lib/calculations";
import {
  getAdminUsers,
  getDashboardSummary,
  getExternalEventsForSchedule,
  getInviteCodes,
  getMarketDetail,
  getMarkets,
  getMyBets,
  getStats,
} from "@/lib/data";
import { query, transaction } from "@/lib/db";
import {
  formatHandicap,
  getAsianHandicapStatus,
  syncWorldCupScheduleAndSettle,
} from "@/lib/sports/world-cup";
import type { Group, GroupMember, GroupRole, MarketStatus, SystemRole, User } from "@/types/domain";

const PORT = Number(process.env.API_PORT || 4000);
const SESSION_COOKIE = "wc_session";
const SESSION_DAYS = 30;

type CurrentUser = User & {
  group?: Group;
  membership?: GroupMember;
};

type ApiRequest = http.IncomingMessage & {
  body?: Record<string, unknown>;
  user?: CurrentUser;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isValidUsername(username: string) {
  return /^[a-z0-9_-]{3,32}$/.test(username);
}

function normalizeStatus(status: string): MarketStatus {
  const allowed = new Set([
    "pending",
    "won",
    "lost",
    "push",
    "half_won",
    "half_lost",
    "void",
  ]);
  return allowed.has(status) ? (status as MarketStatus) : "pending";
}

function canManageSystem(user: CurrentUser) {
  return user.system_role === "super_admin" || user.system_role === "admin";
}

function canManageGroup(user: CurrentUser) {
  return (
    canManageSystem(user) ||
    user.membership?.role === "owner" ||
    user.membership?.role === "admin"
  );
}

function canEditMarket(user: CurrentUser, createdByUserId: string) {
  return canManageGroup(user) || user.id === createdByUserId;
}

function cookieValue(request: http.IncomingMessage, key: string) {
  const cookie = request.headers.cookie || "";
  const parts = cookie.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${key}=`));
  return found ? decodeURIComponent(found.slice(key.length + 1)) : "";
}

function isSecureRequest(request: http.IncomingMessage) {
  return request.headers["x-forwarded-proto"] === "https";
}

function setJson(response: http.ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setError(response: http.ServerResponse, status: number, message: string) {
  setJson(response, status, { error: message });
}

async function readJson(request: ApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringBody(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberBody(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function booleanBody(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return value === true || value === "true" || value === "1" || value === "on";
}

function inviteCode() {
  return crypto.randomBytes(5).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X");
}

function normalizeSystemRole(role: string): SystemRole {
  if (["super_admin", "admin", "member", "viewer", "disabled"].includes(role)) {
    return role as SystemRole;
  }
  return "member";
}

function normalizeGroupRole(role: string): GroupRole {
  if (["owner", "admin", "member", "viewer"].includes(role)) return role as GroupRole;
  return "member";
}

function isValidHandicap(value: number) {
  return (
    Number.isFinite(value) &&
    value >= -20 &&
    value <= 20 &&
    Math.abs(value * 4 - Math.round(value * 4)) < 0.001
  );
}

async function createSession(
  response: http.ServerResponse,
  userId: string,
  secure: boolean,
) {
  const token = crypto.randomBytes(32).toString("base64url");
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `insert into sessions (id, user_id, expires_at)
     values ($1, $2, $3)`,
    [id, userId, expiresAt],
  );

  response.setHeader(
    "set-cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${
      secure ? "; Secure" : ""
    }`,
  );
}

async function clearSession(request: http.IncomingMessage, response: http.ServerResponse) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    await query("delete from sessions where id = $1", [hashToken(token)]);
  }
  response.setHeader(
    "set-cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

async function getCurrentUser(request: http.IncomingMessage): Promise<CurrentUser | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;

  const result = await query<
    User & {
      group_id: string | null;
      group_name: string | null;
      member_role: GroupMember["role"] | null;
    }
  >(
    `select u.id,
            u.username,
            u.display_name,
            u.system_role,
            u.disabled_at,
            u.created_at,
            gm.group_id,
            g.name as group_name,
            gm.role as member_role
       from sessions s
       join users u on u.id = s.user_id
       left join group_members gm on gm.user_id = u.id
       left join groups g on g.id = gm.group_id
      where s.id = $1
        and s.expires_at > now()
      order by gm.created_at asc
      limit 1`,
    [hashToken(token)],
  );

  const user = result.rows[0];
  if (!user || user.disabled_at || user.system_role === "disabled") return null;

  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    system_role: user.system_role,
    disabled_at: user.disabled_at,
    created_at: user.created_at,
    group:
      user.group_id && user.group_name
        ? { id: user.group_id, name: user.group_name, created_at: "" }
        : undefined,
    membership:
      user.group_id && user.member_role
        ? { group_id: user.group_id, user_id: user.id, role: user.member_role }
        : undefined,
  };
}

async function requireUser(request: ApiRequest, response: http.ServerResponse) {
  const user = await getCurrentUser(request);
  if (!user?.group) {
    setError(response, 401, "Unauthorized");
    return null;
  }
  request.user = user;
  return user;
}

async function requireAdmin(request: ApiRequest, response: http.ServerResponse) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (!canManageSystem(user)) {
    setError(response, 403, "Forbidden");
    return null;
  }
  return user;
}

function routePath(request: http.IncomingMessage) {
  const url = new URL(request.url || "/", "http://api");
  return { pathname: url.pathname, searchParams: url.searchParams };
}

async function handleAuth(request: ApiRequest, response: http.ServerResponse, pathname: string) {
  const body = request.body || {};

  if (request.method === "GET" && pathname === "/auth/me") {
    setJson(response, 200, { user: await getCurrentUser(request) });
    return true;
  }

  if (request.method === "POST" && pathname === "/auth/logout") {
    await clearSession(request, response);
    setJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && pathname === "/auth/login") {
    const username = normalizeUsername(stringBody(body, "username"));
    const password = stringBody(body, "password");
    if (!username || !password) {
      setError(response, 400, "请输入用户名和密码");
      return true;
    }

    const result = await query<{
      id: string;
      password_hash: string;
      disabled_at: string | null;
      system_role: string;
    }>(
      `select id, password_hash, disabled_at, system_role
         from users
        where username = $1
        limit 1`,
      [username],
    );

    const user = result.rows[0];
    if (
      !user ||
      user.disabled_at ||
      user.system_role === "disabled" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      setError(response, 401, "用户名或密码不正确");
      return true;
    }

    await createSession(response, user.id, isSecureRequest(request));
    setJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && pathname === "/auth/register") {
    const invite = stringBody(body, "invite").toUpperCase();
    const username = normalizeUsername(stringBody(body, "username"));
    const displayName = stringBody(body, "displayName") || username;
    const password = stringBody(body, "password");
    const confirmPassword = stringBody(body, "confirmPassword");

    if (!invite) {
      setError(response, 400, "请输入邀请码");
      return true;
    }
    if (!isValidUsername(username)) {
      setError(response, 400, "用户名只能包含字母、数字、下划线、短横线，长度 3-32");
      return true;
    }
    if (password.length < 8) {
      setError(response, 400, "密码至少 8 位");
      return true;
    }
    if (password !== confirmPassword) {
      setError(response, 400, "两次密码不一致");
      return true;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let newUserId = "";

    try {
      await transaction(async (client) => {
        const inviteResult = await client.query<{
          id: string;
          group_id: string;
          role_on_signup: string;
          max_uses: number;
          used_count: number;
          expires_at: string | null;
          is_active: boolean;
        }>(
          `select id, group_id, role_on_signup, max_uses, used_count, expires_at, is_active
             from invite_codes
            where code = $1
            for update`,
          [invite],
        );

        const inviteCode = inviteResult.rows[0];
        if (!inviteCode || !inviteCode.is_active) throw new Error("邀请码无效");
        if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
          throw new Error("邀请码已过期");
        }
        if (inviteCode.used_count >= inviteCode.max_uses) throw new Error("邀请码已用完");

        const existing = await client.query("select 1 from users where username = $1", [
          username,
        ]);
        if (existing.rows.length > 0) throw new Error("用户名已存在");

        newUserId = crypto.randomUUID();
        await client.query(
          `insert into users (id, username, display_name, password_hash, system_role)
           values ($1, $2, $3, $4, 'member')`,
          [newUserId, username, displayName, passwordHash],
        );
        await client.query(
          `insert into group_members (group_id, user_id, role)
           values ($1, $2, $3)`,
          [inviteCode.group_id, newUserId, inviteCode.role_on_signup],
        );
        await client.query(
          `update invite_codes set used_count = used_count + 1 where id = $1`,
          [inviteCode.id],
        );
      });
    } catch (error) {
      setError(response, 400, error instanceof Error ? error.message : "注册失败");
      return true;
    }

    await createSession(response, newUserId, isSecureRequest(request));
    setJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

async function handleReadModels(
  request: ApiRequest,
  response: http.ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
) {
  if (request.method !== "GET") return false;
  const user = await requireUser(request, response);
  if (!user) return true;

  if (pathname === "/dashboard") {
    setJson(response, 200, await getDashboardSummary(user.group!.id, user.id));
    return true;
  }
  if (pathname === "/markets") {
    setJson(
      response,
      200,
      await getMarkets(user.group!.id, searchParams.get("q") || "", searchParams.get("status") || ""),
    );
    return true;
  }
  if (pathname.startsWith("/markets/")) {
    const marketId = pathname.split("/")[2];
    setJson(response, 200, await getMarketDetail(user.group!.id, marketId, user.id));
    return true;
  }
  if (pathname === "/bets") {
    setJson(response, 200, await getMyBets(user.group!.id, user.id));
    return true;
  }
  if (pathname === "/stats") {
    setJson(response, 200, await getStats(user.group!.id));
    return true;
  }
  if (pathname === "/schedule") {
    setJson(response, 200, await getExternalEventsForSchedule(user.group!.id));
    return true;
  }
  if (pathname === "/admin/users") {
    if (!(await requireAdmin(request, response))) return true;
    setJson(response, 200, await getAdminUsers(user.group!.id));
    return true;
  }
  if (pathname === "/admin/invites") {
    if (!(await requireAdmin(request, response))) return true;
    setJson(response, 200, await getInviteCodes(user.group!.id));
    return true;
  }

  return false;
}

async function handleMarketWrites(request: ApiRequest, response: http.ServerResponse, pathname: string) {
  if (request.method !== "POST" && request.method !== "PUT" && request.method !== "DELETE") return false;
  const user = await requireUser(request, response);
  if (!user) return true;
  const body = request.body || {};

  if (request.method === "POST" && pathname === "/schedule/sync") {
    setJson(
      response,
      200,
      await syncWorldCupScheduleAndSettle({ actorUserId: user.id, groupId: user.group!.id }),
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/markets") {
    const project = stringBody(body, "project");
    const content = stringBody(body, "content");
    const category = stringBody(body, "category") || "投注";
    const eventDate = stringBody(body, "eventDate");
    const eventTime = stringBody(body, "eventTime");
    const odds = numberBody(body, "odds");
    const note = stringBody(body, "note");
    if (!project || !content || !eventDate || odds <= 0) {
      setError(response, 400, "项目、投注内容、日期和赔率必填");
      return true;
    }

    const id = crypto.randomUUID();
    await query(
      `insert into markets
        (id, group_id, project, content, category, event_date, event_time, odds, note, created_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, nullif($9, ''), $10)`,
      [id, user.group!.id, project, content, category, eventDate, eventTime, odds, note, user.id],
    );
    await query(
      `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action)
       values ($1, $2, $3, 'market', $4, 'create')`,
      [crypto.randomUUID(), user.group!.id, user.id, id],
    );
    setJson(response, 201, { id });
    return true;
  }

  if (request.method === "POST" && pathname === "/markets/from-event") {
    const externalEventId = stringBody(body, "externalEventId");
    const selectionHomeAway = stringBody(body, "selectionHomeAway");
    const handicap = numberBody(body, "handicap");
    const odds = numberBody(body, "odds");
    const note = stringBody(body, "note");
    if (
      !externalEventId ||
      (selectionHomeAway !== "home" && selectionHomeAway !== "away") ||
      !isValidHandicap(handicap) ||
      odds <= 0
    ) {
      setError(response, 400, "比赛、球队、盘口值和赔率必填，盘口值只能按 0.25 递增");
      return true;
    }

    const eventResult = await query<{
      id: string;
      home_team_id: string | null;
      home_team_name: string;
      home_score: number | null;
      away_team_id: string | null;
      away_team_name: string;
      away_score: number | null;
      completed: boolean;
      event_date: string;
      event_time: string;
    }>(
      `select id,
              home_team_id,
              home_team_name,
              home_score,
              away_team_id,
              away_team_name,
              away_score,
              completed,
              to_char(event_date, 'YYYY-MM-DD') as event_date,
              event_time
         from external_events
        where id = $1
        limit 1`,
      [externalEventId],
    );
    const event = eventResult.rows[0];
    if (!event) {
      setError(response, 400, "请先同步赛程后再创建盘口");
      return true;
    }

    const duplicate = await query<{ id: string }>(
      `select id
         from markets
        where group_id = $1
          and archived_at is null
          and external_event_id = $2
          and settlement_kind = 'asian_handicap'
          and selection_home_away = $3
          and handicap = $4
          and odds = $5
        limit 1`,
      [user.group!.id, event.id, selectionHomeAway, handicap, odds],
    );
    if (duplicate.rows[0]) {
      setJson(response, 200, { id: duplicate.rows[0].id });
      return true;
    }

    const selectedTeamName = selectionHomeAway === "home" ? event.home_team_name : event.away_team_name;
    const selectedTeamId = selectionHomeAway === "home" ? event.home_team_id : event.away_team_id;
    const status =
      event.completed && event.home_score !== null && event.away_score !== null
        ? getAsianHandicapStatus(
            selectionHomeAway === "home" ? event.home_score : event.away_score,
            selectionHomeAway === "home" ? event.away_score : event.home_score,
            handicap,
          )
        : "pending";
    const id = crypto.randomUUID();
    await query(
      `insert into markets
        (id, group_id, project, content, category, event_date, event_time, status, odds, note,
         created_by_user_id, external_event_id, auto_settle, settlement_kind, selection_team_id,
         selection_team_name, selection_home_away, handicap, settled_from_event_at)
       values ($1, $2, $3, $4, '投注', $5, $6, $7, $8, nullif($9, ''), $10,
               $11, true, 'asian_handicap', $12, $13, $14, $15,
               case when $7::text = 'pending' then null else now() end)`,
      [
        id,
        user.group!.id,
        `${event.home_team_name} vs ${event.away_team_name}`,
        `${selectedTeamName} ${formatHandicap(handicap)}`,
        event.event_date,
        event.event_time,
        status,
        odds,
        note,
        user.id,
        event.id,
        selectedTeamId,
        selectedTeamName,
        selectionHomeAway,
        handicap,
      ],
    );
    await query(
      `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action, detail)
       values ($1, $2, $3, 'market', $4, 'create_from_event',
               jsonb_build_object('externalEventId', $5::text, 'selection', $6::text, 'handicap', $7::numeric))`,
      [crypto.randomUUID(), user.group!.id, user.id, id, event.id, selectionHomeAway, handicap],
    );
    setJson(response, 201, { id });
    return true;
  }

  if (request.method === "POST" && pathname === "/markets/settlement/day") {
    const eventDate = stringBody(body, "eventDate");
    const isSettled = booleanBody(body, "isSettled");
    if (!eventDate) {
      setError(response, 400, "请选择入账日期");
      return true;
    }

    const canSettleAll = canManageGroup(user);
    const params: unknown[] = [user.group!.id, eventDate, isSettled];
    const ownerClause = canSettleAll ? "" : "and created_by_user_id = $4";
    if (!canSettleAll) params.push(user.id);

    const result = await query<{ id: string }>(
      `update markets
          set is_settled = $3,
              updated_at = now()
        where group_id = $1
          and event_date = $2::date
          and archived_at is null
          ${ownerClause}
        returning id`,
      params,
    );
    await query(
      `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action, detail)
       values ($1, $2, $3, 'market', $4, 'settle_day',
               jsonb_build_object('eventDate', $5::text, 'isSettled', $6::boolean, 'count', $7::int))`,
      [
        crypto.randomUUID(),
        user.group!.id,
        user.id,
        eventDate,
        eventDate,
        isSettled,
        result.rows.length,
      ],
    );
    setJson(response, 200, { ok: true, count: result.rows.length });
    return true;
  }

  const match = pathname.match(/^\/markets\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return false;
  const marketId = match[1];
  const action = match[2];

  if (request.method === "PUT" && !action) {
    const project = stringBody(body, "project");
    const content = stringBody(body, "content");
    const category = stringBody(body, "category") || "投注";
    const eventDate = stringBody(body, "eventDate");
    const eventTime = stringBody(body, "eventTime");
    const odds = numberBody(body, "odds");
    const status = normalizeStatus(stringBody(body, "status"));
    const note = stringBody(body, "note");
    if (!project || !content || !eventDate || odds <= 0) {
      setError(response, 400, "项目、投注内容、日期和赔率必填");
      return true;
    }

    await transaction(async (client) => {
      const marketResult = await client.query<{ created_by_user_id: string; group_id: string }>(
        `select created_by_user_id, group_id from markets where id = $1 for update`,
        [marketId],
      );
      const market = marketResult.rows[0];
      if (!market || market.group_id !== user.group!.id || !canEditMarket(user, market.created_by_user_id)) {
        throw new Error("没有权限修改该盘口");
      }
      await client.query(
        `update markets
            set project = $1,
                content = $2,
                category = $3,
                event_date = $4,
                event_time = $5,
                odds = $6,
                status = $7,
                note = nullif($8, ''),
                updated_at = now()
          where id = $9`,
        [project, content, category, eventDate, eventTime, odds, status, note, marketId],
      );
      const bets = await client.query<{ id: string; stake: string }>(
        `select id, stake from bets where market_id = $1 and manual_payout = false`,
        [marketId],
      );
      for (const bet of bets.rows) {
        const settlement = calculateSettlement(status, Number(bet.stake), odds);
        await client.query(
          `update bets
              set payout = $1,
                  profit = $2,
                  updated_at = now()
            where id = $3`,
          [settlement.payout, settlement.profit, bet.id],
        );
      }
      await client.query(
        `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action, detail)
         values ($1, $2, $3, 'market', $4, 'update', jsonb_build_object('status', $5::text))`,
        [crypto.randomUUID(), user.group!.id, user.id, marketId, status],
      );
    });
    setJson(response, 200, { id: marketId });
    return true;
  }

  if (request.method === "POST" && action === "archive") {
    const marketResult = await query<{ created_by_user_id: string; group_id: string }>(
      `select created_by_user_id, group_id from markets where id = $1`,
      [marketId],
    );
    const market = marketResult.rows[0];
    if (!market || market.group_id !== user.group!.id || !canEditMarket(user, market.created_by_user_id)) {
      setError(response, 403, "没有权限归档该盘口");
      return true;
    }
    await query(`update markets set archived_at = now(), updated_at = now() where id = $1`, [marketId]);
    await query(
      `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action)
       values ($1, $2, $3, 'market', $4, 'archive')`,
      [crypto.randomUUID(), user.group!.id, user.id, marketId],
    );
    setJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && action === "settlement") {
    const isSettled = booleanBody(body, "isSettled");
    const marketResult = await query<{ created_by_user_id: string; group_id: string }>(
      `select created_by_user_id, group_id from markets where id = $1 and archived_at is null`,
      [marketId],
    );
    const market = marketResult.rows[0];
    if (!market || market.group_id !== user.group!.id) {
      setError(response, 404, "盘口不存在");
      return true;
    }
    if (!canEditMarket(user, market.created_by_user_id)) {
      setError(response, 403, "没有权限修改该盘口入账状态");
      return true;
    }
    await query(
      `update markets
          set is_settled = $1,
              updated_at = now()
        where id = $2`,
      [isSettled, marketId],
    );
    await query(
      `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action, detail)
       values ($1, $2, $3, 'market', $4, 'settlement_update',
               jsonb_build_object('isSettled', $5::boolean))`,
      [crypto.randomUUID(), user.group!.id, user.id, marketId, isSettled],
    );
    setJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && action === "bet") {
    const stake = numberBody(body, "stake");
    const payoutInput = stringBody(body, "payout");
    const note = stringBody(body, "note");
    const manualPayout = payoutInput !== "";
    if (stake <= 0) {
      setError(response, 400, "投入必须大于 0");
      return true;
    }
    const marketResult = await query<{ id: string; group_id: string; status: MarketStatus; odds: string }>(
      `select id, group_id, status, odds from markets where id = $1 and archived_at is null`,
      [marketId],
    );
    const market = marketResult.rows[0];
    if (!market || market.group_id !== user.group!.id) {
      setError(response, 404, "盘口不存在");
      return true;
    }
    const settlement = calculateSettlement(market.status, stake, Number(market.odds));
    const payout = manualPayout ? numberBody(body, "payout") : settlement.payout;
    const profit = manualPayout
      ? Math.round((Number(payout) - stake) * 100) / 100
      : settlement.profit;
    await query(
      `insert into bets (id, market_id, user_id, stake, payout, profit, note, manual_payout)
       values ($1, $2, $3, $4, $5, $6, nullif($7, ''), $8)
       on conflict (market_id, user_id)
       do update set stake = excluded.stake,
                     payout = excluded.payout,
                     profit = excluded.profit,
                     note = excluded.note,
                     manual_payout = excluded.manual_payout,
                     updated_at = now()`,
      [crypto.randomUUID(), marketId, user.id, stake, payout, profit, note, manualPayout],
    );
    await query(
      `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action)
       values ($1, $2, $3, 'bet', $4, 'save')`,
      [crypto.randomUUID(), user.group!.id, user.id, marketId],
    );
    setJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "DELETE" && action === "bet") {
    await query(`delete from bets where market_id = $1 and user_id = $2`, [marketId, user.id]);
    setJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

async function handleAdminWrites(request: ApiRequest, response: http.ServerResponse, pathname: string) {
  if (request.method !== "POST" && request.method !== "PUT") return false;
  const admin = await requireAdmin(request, response);
  if (!admin) return true;
  const body = request.body || {};

  if (request.method === "POST" && pathname === "/admin/invites") {
    const role = normalizeGroupRole(stringBody(body, "role"));
    const maxUses = Math.max(1, numberBody(body, "maxUses") || 1);
    const expiresAt = stringBody(body, "expiresAt");
    const note = stringBody(body, "note");
    const code = stringBody(body, "code").toUpperCase() || inviteCode();
    await query(
      `insert into invite_codes
         (id, code, created_by_user_id, group_id, role_on_signup, max_uses, expires_at, note)
       values ($1, $2, $3, $4, $5, $6, nullif($7, '')::timestamptz, nullif($8, ''))`,
      [crypto.randomUUID(), code, admin.id, admin.group!.id, role, maxUses, expiresAt, note],
    );
    setJson(response, 201, { ok: true });
    return true;
  }

  const inviteMatch = pathname.match(/^\/admin\/invites\/([^/]+)\/toggle$/);
  if (request.method === "POST" && inviteMatch) {
    await query(
      `update invite_codes
          set is_active = not is_active
        where id = $1 and group_id = $2`,
      [inviteMatch[1], admin.group!.id],
    );
    setJson(response, 200, { ok: true });
    return true;
  }

  const userMatch = pathname.match(/^\/admin\/users\/([^/]+)$/);
  if (request.method === "PUT" && userMatch) {
    const userId = userMatch[1];
    const displayName = stringBody(body, "displayName");
    const systemRole = normalizeSystemRole(stringBody(body, "systemRole"));
    const groupRole = normalizeGroupRole(stringBody(body, "groupRole"));
    const password = stringBody(body, "password");
    if (!displayName) {
      setError(response, 400, "用户和显示名必填");
      return true;
    }
    if (userId === admin.id && systemRole !== "super_admin") {
      setError(response, 400, "不能降低当前登录管理员的权限");
      return true;
    }
    const params: unknown[] = [displayName, systemRole, userId];
    let passwordSql = "";
    if (password) {
      if (password.length < 8) {
        setError(response, 400, "临时密码至少 8 位");
        return true;
      }
      params.push(await bcrypt.hash(password, 12));
      passwordSql = ", password_hash = $4";
    }
    await query(
      `update users
          set display_name = $1,
              system_role = $2,
              disabled_at = case when $2 = 'disabled' then coalesce(disabled_at, now()) else null end,
              updated_at = now()
              ${passwordSql}
        where id = $3`,
      params,
    );
    await query(
      `update group_members
          set role = $1
        where group_id = $2 and user_id = $3`,
      [groupRole, admin.group!.id, userId],
    );
    setJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

async function mainHandler(request: ApiRequest, response: http.ServerResponse) {
  try {
    const { pathname, searchParams } = routePath(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      request.body = await readJson(request);
    }

    if (await handleAuth(request, response, pathname)) return;

    if (request.method === "POST" && pathname === "/internal/sync/scores") {
      if (request.headers["x-sync-secret"] !== process.env.SYNC_SECRET) {
        return setError(response, 401, "Unauthorized");
      }
      return setJson(response, 200, await syncWorldCupScheduleAndSettle());
    }

    if (await handleReadModels(request, response, pathname, searchParams)) return;
    if (await handleMarketWrites(request, response, pathname)) return;
    if (await handleAdminWrites(request, response, pathname)) return;

    setError(response, 404, "Not found");
  } catch (error) {
    console.error(error);
    setError(response, 500, error instanceof Error ? error.message : "Internal error");
  }
}

http.createServer(mainHandler).listen(PORT, "0.0.0.0", () => {
  console.log(`world-cup-ledger API listening on ${PORT}`);
});
