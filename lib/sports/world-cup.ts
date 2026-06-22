import crypto from "node:crypto";

import { calculateSettlement } from "@/lib/calculations";
import { query, transaction } from "@/lib/db";
import type { MarketStatus } from "@/types/domain";

const ESPN_PROVIDER = "espn";
const DEFAULT_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const DEFAULT_DATES = "20260611-20260719";

type TeamSide = "home" | "away";

type NormalizedEvent = {
  id: string;
  provider: string;
  externalId: string;
  uid: string | null;
  name: string;
  shortName: string | null;
  stage: string | null;
  venue: string | null;
  eventDate: string;
  eventTime: string;
  startsAt: string;
  statusState: "pre" | "in" | "post";
  statusDetail: string | null;
  completed: boolean;
  homeTeamId: string | null;
  homeTeamName: string;
  homeTeamAbbr: string | null;
  homeScore: number | null;
  awayTeamId: string | null;
  awayTeamName: string;
  awayTeamAbbr: string | null;
  awayScore: number | null;
  raw: unknown;
};

type EspnCompetitor = {
  id?: string;
  homeAway?: TeamSide;
  score?: string;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
  };
};

type EspnEvent = {
  id?: string;
  uid?: string;
  date?: string;
  name?: string;
  shortName?: string;
  season?: { slug?: string };
  competitions?: Array<{
    date?: string;
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
        detail?: string;
        shortDetail?: string;
        description?: string;
      };
    };
    venue?: {
      fullName?: string;
      displayName?: string;
    };
    altGameNote?: string;
    competitors?: EspnCompetitor[];
  }>;
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      detail?: string;
      shortDetail?: string;
      description?: string;
    };
  };
  venue?: { displayName?: string };
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

type SettledMarketRow = {
  id: string;
  group_id: string;
  odds: string;
  selection_home_away: TeamSide;
  handicap: string;
  home_score: number;
  away_score: number;
  external_event_id: string;
};

function getScoreboardUrl() {
  const configured = process.env.WORLD_CUP_SCOREBOARD_URL?.trim();
  if (configured) return configured;

  const url = new URL(DEFAULT_SCOREBOARD_URL);
  url.searchParams.set("dates", process.env.WORLD_CUP_DATES || DEFAULT_DATES);
  url.searchParams.set("limit", process.env.WORLD_CUP_SCOREBOARD_LIMIT || "200");
  return url.toString();
}

function appTimeZone() {
  return process.env.APP_TIME_ZONE || "Asia/Shanghai";
}

function formatDateTimeInAppZone(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scoreOrNull(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function normalizeStatus(state: string | undefined): "pre" | "in" | "post" {
  if (state === "post") return "post";
  if (state === "in") return "in";
  return "pre";
}

function teamName(competitor: EspnCompetitor | undefined, fallback: string) {
  return (
    textOrNull(competitor?.team?.displayName) ??
    textOrNull(competitor?.team?.shortDisplayName) ??
    fallback
  );
}

function normalizeEspnEvent(event: EspnEvent): NormalizedEvent | null {
  const externalId = textOrNull(event.id);
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((competitor) => competitor.homeAway === "home") ?? competitors[0];
  const away = competitors.find((competitor) => competitor.homeAway === "away") ?? competitors[1];

  if (!externalId || !home || !away) return null;

  const startsAt = competition?.date ?? event.date ?? new Date().toISOString();
  const local = formatDateTimeInAppZone(startsAt);
  const statusType = competition?.status?.type ?? event.status?.type;

  return {
    id: `${ESPN_PROVIDER}:${externalId}`,
    provider: ESPN_PROVIDER,
    externalId,
    uid: textOrNull(event.uid),
    name: textOrNull(event.name) ?? `${teamName(away, "Away")} at ${teamName(home, "Home")}`,
    shortName: textOrNull(event.shortName),
    stage: textOrNull(competition?.altGameNote) ?? textOrNull(event.season?.slug),
    venue: textOrNull(competition?.venue?.fullName) ?? textOrNull(event.venue?.displayName),
    eventDate: local.date,
    eventTime: local.time,
    startsAt,
    statusState: normalizeStatus(statusType?.state),
    statusDetail:
      textOrNull(statusType?.shortDetail) ??
      textOrNull(statusType?.detail) ??
      textOrNull(statusType?.description),
    completed: Boolean(statusType?.completed),
    homeTeamId: textOrNull(home.team?.id ?? home.id),
    homeTeamName: teamName(home, "Home"),
    homeTeamAbbr: textOrNull(home.team?.abbreviation),
    homeScore: scoreOrNull(home.score),
    awayTeamId: textOrNull(away.team?.id ?? away.id),
    awayTeamName: teamName(away, "Away"),
    awayTeamAbbr: textOrNull(away.team?.abbreviation),
    awayScore: scoreOrNull(away.score),
    raw: {
      id: event.id,
      uid: event.uid,
      date: startsAt,
      status: statusType,
      season: event.season,
    },
  };
}

async function fetchWorldCupEvents() {
  const response = await fetch(getScoreboardUrl(), {
    headers: {
      accept: "application/json",
      "user-agent": "world-cup-ledger/0.1",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`World Cup schedule sync failed: ${response.status}`);
  }

  const payload = (await response.json()) as EspnScoreboard;
  return (payload.events ?? [])
    .map(normalizeEspnEvent)
    .filter((event): event is NormalizedEvent => event !== null);
}

export function formatHandicap(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (Object.is(rounded, -0)) return "+0";
  const absolute = Math.abs(rounded);
  const text = Number.isInteger(absolute)
    ? absolute.toFixed(0)
    : absolute.toFixed(2).replace(/0$/, "");
  return `${rounded >= 0 ? "+" : "-"}${text}`;
}

export function getAsianHandicapStatus(
  selectedScore: number,
  opponentScore: number,
  handicap: number,
): MarketStatus {
  const adjusted = Math.round((selectedScore - opponentScore + handicap) * 4) / 4;
  if (adjusted >= 0.5) return "won";
  if (adjusted <= -0.5) return "lost";
  if (Math.abs(adjusted) < 0.001) return "push";
  return adjusted > 0 ? "half_won" : "half_lost";
}

async function upsertEvent(event: NormalizedEvent) {
  await query(
    `insert into external_events
       (id,
        provider,
        external_id,
        uid,
        name,
        short_name,
        stage,
        venue,
        event_date,
        event_time,
        starts_at,
        status_state,
        status_detail,
        completed,
        home_team_id,
        home_team_name,
        home_team_abbr,
        home_score,
        away_team_id,
        away_team_name,
        away_team_abbr,
        away_score,
        raw,
        last_synced_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19,
             $20, $21, $22, $23, now())
     on conflict (provider, external_id)
     do update set uid = excluded.uid,
                   name = excluded.name,
                   short_name = excluded.short_name,
                   stage = excluded.stage,
                   venue = excluded.venue,
                   event_date = excluded.event_date,
                   event_time = excluded.event_time,
                   starts_at = excluded.starts_at,
                   status_state = excluded.status_state,
                   status_detail = excluded.status_detail,
                   completed = excluded.completed,
                   home_team_id = excluded.home_team_id,
                   home_team_name = excluded.home_team_name,
                   home_team_abbr = excluded.home_team_abbr,
                   home_score = excluded.home_score,
                   away_team_id = excluded.away_team_id,
                   away_team_name = excluded.away_team_name,
                   away_team_abbr = excluded.away_team_abbr,
                   away_score = excluded.away_score,
                   raw = excluded.raw,
                   last_synced_at = now()`,
    [
      event.id,
      event.provider,
      event.externalId,
      event.uid,
      event.name,
      event.shortName,
      event.stage,
      event.venue,
      event.eventDate,
      event.eventTime,
      event.startsAt,
      event.statusState,
      event.statusDetail,
      event.completed,
      event.homeTeamId,
      event.homeTeamName,
      event.homeTeamAbbr,
      event.homeScore,
      event.awayTeamId,
      event.awayTeamName,
      event.awayTeamAbbr,
      event.awayScore,
      JSON.stringify(event.raw),
    ],
  );
}

async function settleCompletedMarkets(actorUserId?: string | null, groupId?: string) {
  return transaction(async (client) => {
    const params: unknown[] = [];
    const groupClause = groupId ? "and m.group_id = $1" : "";
    if (groupId) params.push(groupId);

    const markets = await client.query<SettledMarketRow>(
      `select m.id,
              m.group_id,
              m.odds,
              m.selection_home_away,
              m.handicap,
              m.external_event_id,
              e.home_score,
              e.away_score
         from markets m
         join external_events e on e.id = m.external_event_id
        where m.archived_at is null
          and m.status = 'pending'
          and m.auto_settle = true
          and m.settlement_kind = 'asian_handicap'
          and m.selection_home_away in ('home', 'away')
          and m.handicap is not null
          and e.completed = true
          and e.home_score is not null
          and e.away_score is not null
          ${groupClause}
        for update`,
      params,
    );

    let settledMarkets = 0;
    let settledBets = 0;

    for (const market of markets.rows) {
      const selectedScore =
        market.selection_home_away === "home" ? market.home_score : market.away_score;
      const opponentScore =
        market.selection_home_away === "home" ? market.away_score : market.home_score;
      const status = getAsianHandicapStatus(
        Number(selectedScore),
        Number(opponentScore),
        Number(market.handicap),
      );

      await client.query(
        `update markets
            set status = $1,
                settled_from_event_at = now(),
                updated_at = now()
          where id = $2`,
        [status, market.id],
      );

      const bets = await client.query<{ id: string; stake: string }>(
        `select id, stake from bets where market_id = $1 and manual_payout = false`,
        [market.id],
      );

      for (const bet of bets.rows) {
        const settlement = calculateSettlement(status, Number(bet.stake), Number(market.odds));
        await client.query(
          `update bets
              set payout = $1,
                  profit = $2,
                  updated_at = now()
            where id = $3`,
          [settlement.payout, settlement.profit, bet.id],
        );
        settledBets += 1;
      }

      await client.query(
        `insert into audit_logs (id, group_id, actor_user_id, entity_type, entity_id, action, detail)
         values ($1, $2, $3, 'market', $4, 'auto_settle',
                 jsonb_build_object('externalEventId', $5::text, 'status', $6::text))`,
        [
          crypto.randomUUID(),
          market.group_id,
          actorUserId ?? null,
          market.id,
          market.external_event_id,
          status,
        ],
      );

      settledMarkets += 1;
    }

    return { settledMarkets, settledBets };
  });
}

export async function syncWorldCupScheduleAndSettle(options: {
  actorUserId?: string | null;
  groupId?: string;
} = {}) {
  const events = await fetchWorldCupEvents();
  for (const event of events) {
    await upsertEvent(event);
  }
  const settlement = await settleCompletedMarkets(options.actorUserId, options.groupId);

  return {
    provider: ESPN_PROVIDER,
    fetchedEvents: events.length,
    syncedEvents: events.length,
    ...settlement,
  };
}
