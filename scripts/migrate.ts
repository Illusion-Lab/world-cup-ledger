import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });

function id() {
  return crypto.randomUUID();
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      create table if not exists users (
        id text primary key,
        username text not null unique,
        display_name text not null,
        password_hash text not null,
        system_role text not null default 'member',
        disabled_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint users_system_role_check
          check (system_role in ('super_admin', 'admin', 'member', 'viewer', 'disabled'))
      );

      create table if not exists sessions (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );

      create table if not exists groups (
        id text primary key,
        name text not null,
        created_by_user_id text references users(id) on delete set null,
        created_at timestamptz not null default now()
      );

      create table if not exists group_members (
        group_id text not null references groups(id) on delete cascade,
        user_id text not null references users(id) on delete cascade,
        role text not null,
        created_at timestamptz not null default now(),
        primary key (group_id, user_id),
        constraint group_members_role_check
          check (role in ('owner', 'admin', 'member', 'viewer'))
      );

      create table if not exists invite_codes (
        id text primary key,
        code text not null unique,
        created_by_user_id text references users(id) on delete set null,
        group_id text not null references groups(id) on delete cascade,
        role_on_signup text not null default 'member',
        max_uses integer not null default 1,
        used_count integer not null default 0,
        expires_at timestamptz,
        is_active boolean not null default true,
        note text,
        created_at timestamptz not null default now(),
        constraint invite_codes_role_check
          check (role_on_signup in ('owner', 'admin', 'member', 'viewer'))
      );

      create table if not exists markets (
        id text primary key,
        group_id text not null references groups(id) on delete cascade,
        project text not null,
        content text not null,
        category text not null default '投注',
        event_date date not null,
        event_time text not null default '',
        status text not null default 'pending',
        is_settled boolean not null default false,
        odds numeric(10, 3) not null,
        note text,
        created_by_user_id text not null references users(id) on delete restrict,
        external_event_id text,
        auto_settle boolean not null default false,
        settlement_kind text,
        selection_team_id text,
        selection_team_name text,
        selection_home_away text,
        handicap numeric(6, 2),
        settled_from_event_at timestamptz,
        archived_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint markets_status_check
          check (status in ('pending', 'won', 'lost', 'push', 'half_won', 'half_lost', 'void')),
        constraint markets_settlement_kind_check
          check (settlement_kind is null or settlement_kind in ('asian_handicap')),
        constraint markets_selection_home_away_check
          check (selection_home_away is null or selection_home_away in ('home', 'away'))
      );

      create table if not exists external_events (
        id text primary key,
        provider text not null,
        external_id text not null,
        uid text,
        name text not null,
        short_name text,
        stage text,
        venue text,
        event_date date not null,
        event_time text not null,
        starts_at timestamptz not null,
        status_state text not null,
        status_detail text,
        completed boolean not null default false,
        home_team_id text,
        home_team_name text not null,
        home_team_abbr text,
        home_score integer,
        away_team_id text,
        away_team_name text not null,
        away_team_abbr text,
        away_score integer,
        raw jsonb not null default '{}'::jsonb,
        last_synced_at timestamptz not null default now(),
        unique (provider, external_id),
        constraint external_events_status_state_check
          check (status_state in ('pre', 'in', 'post'))
      );

      alter table markets add column if not exists external_event_id text;
      alter table markets add column if not exists auto_settle boolean not null default false;
      alter table markets add column if not exists settlement_kind text;
      alter table markets add column if not exists selection_team_id text;
      alter table markets add column if not exists selection_team_name text;
      alter table markets add column if not exists selection_home_away text;
      alter table markets add column if not exists handicap numeric(6, 2);
      alter table markets add column if not exists settled_from_event_at timestamptz;
      alter table markets add column if not exists is_settled boolean not null default false;

      create table if not exists bets (
        id text primary key,
        market_id text not null references markets(id) on delete cascade,
        user_id text not null references users(id) on delete cascade,
        stake numeric(12, 2) not null,
        payout numeric(12, 2),
        profit numeric(12, 2),
        note text,
        manual_payout boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (market_id, user_id)
      );

      create table if not exists audit_logs (
        id text primary key,
        group_id text references groups(id) on delete cascade,
        actor_user_id text references users(id) on delete set null,
        entity_type text not null,
        entity_id text not null,
        action text not null,
        detail jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists sessions_expires_at_idx on sessions(expires_at);
      create index if not exists markets_group_id_idx on markets(group_id);
      create index if not exists markets_event_date_idx on markets(event_date);
      create index if not exists markets_external_event_id_idx on markets(external_event_id);
      create index if not exists bets_user_id_idx on bets(user_id);
      create index if not exists bets_market_id_idx on bets(market_id);
      create index if not exists audit_logs_group_id_idx on audit_logs(group_id);
      create index if not exists external_events_event_date_idx on external_events(event_date);
      create index if not exists external_events_status_state_idx on external_events(status_state);
    `);

    const userCount = await client.query<{ count: string }>(
      "select count(*)::text as count from users",
    );

    let adminId: string | null = null;
    if (Number(userCount.rows[0]?.count ?? 0) === 0) {
      const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD || "change-me-strong-password";
      const displayName = process.env.ADMIN_DISPLAY_NAME || "管理员";
      const passwordHash = await bcrypt.hash(password, 12);
      adminId = id();
      await client.query(
        `insert into users (id, username, display_name, password_hash, system_role)
         values ($1, $2, $3, $4, 'super_admin')`,
        [adminId, username, displayName, passwordHash],
      );
    } else {
      const admin = await client.query<{ id: string }>(
        `select id from users
          where system_role in ('super_admin', 'admin')
          order by created_at asc
          limit 1`,
      );
      adminId = admin.rows[0]?.id ?? null;
    }

    const groupCount = await client.query<{ count: string }>(
      "select count(*)::text as count from groups",
    );

    if (Number(groupCount.rows[0]?.count ?? 0) === 0) {
      const groupId = id();
      await client.query(
        `insert into groups (id, name, created_by_user_id)
         values ($1, $2, $3)`,
        [groupId, process.env.DEFAULT_GROUP_NAME || "世界杯账本", adminId],
      );
      if (adminId) {
        await client.query(
          `insert into group_members (group_id, user_id, role)
           values ($1, $2, 'owner')
           on conflict (group_id, user_id) do nothing`,
          [groupId, adminId],
        );
      }
    }

    await client.query("delete from sessions where expires_at <= now()");
    await client.query("COMMIT");
    console.log("Migration completed");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
