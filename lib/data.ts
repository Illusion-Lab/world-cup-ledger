import { query } from "@/lib/db";
import type {
  Bet,
  DashboardCalendarDay,
  ExternalEvent,
  InviteCode,
  Market,
  User,
} from "@/types/domain";

const marketColumns = `
  m.id,
  m.group_id,
  m.project,
  m.content,
  m.category,
  to_char(m.event_date, 'YYYY-MM-DD') as event_date,
  m.event_time,
  m.status,
  m.is_settled,
  m.odds,
  m.note,
  m.created_by_user_id,
  m.external_event_id,
  m.auto_settle,
  m.settlement_kind,
  m.selection_team_id,
  m.selection_team_name,
  m.selection_home_away,
  m.handicap,
  m.settled_from_event_at,
  m.archived_at,
  m.created_at,
  m.updated_at
`;

export async function getDashboardSummary(groupId: string, userId: string) {
  const [groupStats, myStats, recentMarkets, calendarDays] = await Promise.all([
    query<{
      market_count: string;
      bet_count: string;
      total_stake: string;
      total_profit: string;
      pending_stake: string;
    }>(
      `select count(distinct m.id)::text as market_count,
              count(b.id)::text as bet_count,
              coalesce(sum(b.stake), 0)::text as total_stake,
              coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit,
              coalesce(sum(b.stake) filter (where m.status = 'pending'), 0)::text as pending_stake
         from markets m
         left join bets b on b.market_id = m.id
        where m.group_id = $1 and m.archived_at is null`,
      [groupId],
    ),
    query<{
      total_stake: string;
      total_profit: string;
      pending_stake: string;
    }>(
      `select coalesce(sum(b.stake), 0)::text as total_stake,
              coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit,
              coalesce(sum(b.stake) filter (where m.status = 'pending'), 0)::text as pending_stake
         from bets b
         join markets m on m.id = b.market_id
        where b.user_id = $1 and m.group_id = $2 and m.archived_at is null`,
      [userId, groupId],
    ),
    query<Market>(
      `select ${marketColumns},
              u.display_name as created_by_name,
              count(b.id)::int as bet_count,
              coalesce(sum(b.stake), 0)::text as total_stake,
              coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit
         from markets m
         join users u on u.id = m.created_by_user_id
         left join bets b on b.market_id = m.id
        where m.group_id = $1 and m.archived_at is null
        group by m.id, u.display_name
        order by m.event_date desc, m.created_at desc
        limit 6`,
      [groupId],
    ),
    query<DashboardCalendarDay>(
      `with event_days as (
          select e.event_date::date as event_date,
                 count(*)::int as event_count,
                 count(*) filter (where e.completed)::int as completed_event_count,
                 jsonb_agg(
                   jsonb_build_object(
                     'id', e.id,
                     'name', e.name,
                     'time', e.event_time,
                     'completed', e.completed,
                     'status_state', e.status_state,
                     'home_score', e.home_score,
                     'away_score', e.away_score,
                     'linked_market_count', coalesce(linked.linked_market_count, 0)
                   )
                   order by e.event_time asc, e.name asc
                 ) as events
            from external_events e
            left join lateral (
              select count(*)::int as linked_market_count
                from markets lm
               where lm.group_id = $1
                 and lm.external_event_id = e.id
                 and lm.archived_at is null
            ) linked on true
           group by e.event_date
        ),
        market_stats as (
          select m.event_date::date as event_date,
                 count(distinct m.id)::int as market_count,
                 count(distinct m.id) filter (where m.status = 'pending')::int as pending_count,
                 count(distinct m.id) filter (where m.status in ('won', 'half_won'))::int as won_count,
                 count(distinct m.id) filter (where m.status in ('lost', 'half_lost'))::int as lost_count,
                 count(distinct m.id) filter (where m.status = 'push')::int as push_count,
                 count(distinct m.id) filter (where m.status = 'void')::int as void_count,
                 coalesce(sum(b.stake), 0)::text as total_stake,
                 coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit
            from markets m
            left join bets b on b.market_id = m.id
           where m.group_id = $1 and m.archived_at is null
           group by m.event_date
        ),
        market_items as (
          select x.event_date,
                 jsonb_agg(
                   jsonb_build_object(
                     'id', x.id,
                     'project', x.project,
                     'content', x.content,
                     'time', x.event_time,
                     'status', x.status,
                     'is_settled', x.is_settled,
                     'stake', x.stake,
                     'profit', x.profit,
                     'bet_count', x.bet_count
                   )
                   order by x.event_time asc, x.created_at asc
                 ) as markets
            from (
              select m.id,
                     m.event_date::date as event_date,
                     m.event_time,
                     m.project,
                     m.content,
                     m.status,
                     m.is_settled,
                     m.created_at,
                     count(b.id)::int as bet_count,
                     coalesce(sum(b.stake), 0)::text as stake,
                     coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as profit
                from markets m
                left join bets b on b.market_id = m.id
               where m.group_id = $1 and m.archived_at is null
               group by m.id
            ) x
           group by x.event_date
        ),
        days as (
          select event_date from event_days
          union
          select event_date from market_stats
        )
        select to_char(d.event_date, 'YYYY-MM-DD') as event_date,
               coalesce(ed.event_count, 0)::int as event_count,
               coalesce(ed.completed_event_count, 0)::int as completed_event_count,
               coalesce(ms.market_count, 0)::int as market_count,
               coalesce(ms.pending_count, 0)::int as pending_count,
               coalesce(ms.won_count, 0)::int as won_count,
               coalesce(ms.lost_count, 0)::int as lost_count,
               coalesce(ms.push_count, 0)::int as push_count,
               coalesce(ms.void_count, 0)::int as void_count,
               coalesce(ms.total_stake, '0') as total_stake,
               coalesce(ms.total_profit, '0') as total_profit,
               coalesce(ed.events, '[]'::jsonb) as events,
               coalesce(mi.markets, '[]'::jsonb) as markets
          from days d
          left join event_days ed on ed.event_date = d.event_date
          left join market_stats ms on ms.event_date = d.event_date
          left join market_items mi on mi.event_date = d.event_date
         order by d.event_date asc`,
      [groupId],
    ),
  ]);

  return {
    groupStats: groupStats.rows[0],
    myStats: myStats.rows[0],
    recentMarkets: recentMarkets.rows,
    calendarDays: calendarDays.rows,
  };
}

export async function getMarkets(groupId: string, search = "", status = "") {
  const params: unknown[] = [groupId];
  const clauses = ["m.group_id = $1", "m.archived_at is null"];
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(m.project ilike $${params.length} or m.content ilike $${params.length})`);
  }
  if (status) {
    params.push(status);
    clauses.push(`m.status = $${params.length}`);
  }

  const result = await query<Market>(
    `select ${marketColumns},
            u.display_name as created_by_name,
            count(b.id)::int as bet_count,
            coalesce(sum(b.stake), 0)::text as total_stake,
            coalesce(sum(b.payout) filter (where b.payout is not null), 0)::text as total_payout,
            coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit
       from markets m
       join users u on u.id = m.created_by_user_id
       left join bets b on b.market_id = m.id
      where ${clauses.join(" and ")}
      group by m.id, u.display_name
      order by m.event_date desc, m.created_at desc`,
    params,
  );
  return result.rows;
}

export async function getMarketDetail(groupId: string, marketId: string, userId: string) {
  const [market, bets, myBet, externalEvent] = await Promise.all([
    query<Market>(
      `select ${marketColumns}, u.display_name as created_by_name
         from markets m
         join users u on u.id = m.created_by_user_id
        where m.id = $1 and m.group_id = $2 and m.archived_at is null`,
      [marketId, groupId],
    ),
    query<Bet>(
      `select b.*, u.username, u.display_name
         from bets b
         join users u on u.id = b.user_id
        where b.market_id = $1
        order by b.created_at asc`,
      [marketId],
    ),
    query<Bet>(
      `select * from bets where market_id = $1 and user_id = $2 limit 1`,
      [marketId, userId],
    ),
    query<ExternalEvent>(
      `select id,
              provider,
              external_id,
              uid,
              name,
              short_name,
              stage,
              venue,
              to_char(event_date, 'YYYY-MM-DD') as event_date,
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
              last_synced_at
         from external_events
        where id = (select external_event_id from markets where id = $1 and group_id = $2)
        limit 1`,
      [marketId, groupId],
    ),
  ]);
  return {
    market: market.rows[0] ?? null,
    bets: bets.rows,
    myBet: myBet.rows[0] ?? null,
    externalEvent: externalEvent.rows[0] ?? null,
  };
}

export async function getMyBets(groupId: string, userId: string) {
  const result = await query<Bet>(
    `select b.*,
            m.project,
            m.content,
            m.category,
            m.status,
            m.is_settled,
            m.odds,
            m.note as market_note,
            m.auto_settle,
            m.selection_team_name,
            m.handicap,
            to_char(m.event_date, 'YYYY-MM-DD') as event_date,
            m.event_time
       from bets b
       join markets m on m.id = b.market_id
      where b.user_id = $1 and m.group_id = $2 and m.archived_at is null
      order by m.event_date desc, m.event_time desc, b.updated_at desc`,
    [userId, groupId],
  );
  return result.rows;
}

export async function getStats(groupId: string) {
  const [byUser, byStatus, byCategory] = await Promise.all([
    query<{
      user_id: string;
      display_name: string;
      username: string;
      total_stake: string;
      total_profit: string;
      pending_stake: string;
      bet_count: string;
    }>(
      `select u.id as user_id,
              u.display_name,
              u.username,
              coalesce(sum(b.stake) filter (where m.id is not null), 0)::text as total_stake,
              coalesce(sum(b.profit) filter (where m.id is not null and b.profit is not null), 0)::text as total_profit,
              coalesce(sum(b.stake) filter (where m.status = 'pending'), 0)::text as pending_stake,
              count(b.id) filter (where m.id is not null)::text as bet_count
         from group_members gm
         join users u on u.id = gm.user_id
         left join bets b on b.user_id = u.id
         left join markets m on m.id = b.market_id and m.group_id = gm.group_id and m.archived_at is null
        where gm.group_id = $1
        group by u.id
        order by coalesce(sum(b.profit) filter (where m.id is not null and b.profit is not null), 0) desc`,
      [groupId],
    ),
    query<{
      status: string;
      total_stake: string;
      total_profit: string;
      market_count: string;
    }>(
      `select m.status,
              coalesce(sum(b.stake), 0)::text as total_stake,
              coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit,
              count(distinct m.id)::text as market_count
         from markets m
         left join bets b on b.market_id = m.id
        where m.group_id = $1 and m.archived_at is null
        group by m.status
        order by m.status`,
      [groupId],
    ),
    query<{
      category: string;
      total_stake: string;
      total_profit: string;
      market_count: string;
    }>(
      `select m.category,
              coalesce(sum(b.stake), 0)::text as total_stake,
              coalesce(sum(b.profit) filter (where b.profit is not null), 0)::text as total_profit,
              count(distinct m.id)::text as market_count
         from markets m
         left join bets b on b.market_id = m.id
        where m.group_id = $1 and m.archived_at is null
        group by m.category
        order by m.category`,
      [groupId],
    ),
  ]);

  return { byUser: byUser.rows, byStatus: byStatus.rows, byCategory: byCategory.rows };
}

export async function getAdminUsers(groupId: string) {
  const result = await query<
    User & {
      group_role: string;
      bet_count: string;
      total_stake: string;
      total_profit: string;
    }
  >(
    `select u.id,
            u.username,
            u.display_name,
            u.system_role,
            u.disabled_at,
            u.created_at,
            gm.role as group_role,
            count(b.id) filter (where m.id is not null)::text as bet_count,
            coalesce(sum(b.stake) filter (where m.id is not null), 0)::text as total_stake,
            coalesce(sum(b.profit) filter (where m.id is not null and b.profit is not null), 0)::text as total_profit
       from group_members gm
       join users u on u.id = gm.user_id
       left join bets b on b.user_id = u.id
       left join markets m on m.id = b.market_id and m.group_id = gm.group_id and m.archived_at is null
      where gm.group_id = $1
      group by u.id, gm.role
      order by u.created_at asc`,
    [groupId],
  );
  return result.rows;
}

export async function getInviteCodes(groupId: string) {
  const result = await query<InviteCode>(
    `select i.*, g.name as group_name, u.display_name as creator_name
       from invite_codes i
       join groups g on g.id = i.group_id
       left join users u on u.id = i.created_by_user_id
      where i.group_id = $1
      order by i.created_at desc`,
    [groupId],
  );
  return result.rows;
}

export async function getExternalEventsForSchedule(groupId: string) {
  const result = await query<ExternalEvent>(
    `select e.id,
            e.provider,
            e.external_id,
            e.uid,
            e.name,
            e.short_name,
            e.stage,
            e.venue,
            to_char(e.event_date, 'YYYY-MM-DD') as event_date,
            e.event_time,
            e.starts_at,
            e.status_state,
            e.status_detail,
            e.completed,
            e.home_team_id,
            e.home_team_name,
            e.home_team_abbr,
            e.home_score,
            e.away_team_id,
            e.away_team_name,
            e.away_team_abbr,
            e.away_score,
            e.last_synced_at,
            s.skipped_at,
            s.skipped_by_user_id,
            u.display_name as skipped_by_name,
            count(m.id) filter (where m.archived_at is null)::int as linked_market_count
       from external_events e
       left join markets m on m.external_event_id = e.id and m.group_id = $1
       left join external_event_skips s on s.external_event_id = e.id and s.group_id = $1
       left join users u on u.id = s.skipped_by_user_id
      group by e.id, s.skipped_at, s.skipped_by_user_id, u.display_name
      order by e.starts_at asc`,
    [groupId],
  );
  return result.rows;
}
