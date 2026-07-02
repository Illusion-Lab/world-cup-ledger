export type SystemRole = "super_admin" | "admin" | "member" | "viewer" | "disabled";
export type GroupRole = "owner" | "admin" | "member" | "viewer";

export type MarketStatus =
  | "pending"
  | "won"
  | "lost"
  | "push"
  | "half_won"
  | "half_lost"
  | "void";

export const statusLabels: Record<MarketStatus, string> = {
  pending: "待判定",
  won: "赢",
  lost: "输",
  push: "走水",
  half_won: "半赢",
  half_lost: "半输",
  void: "作废",
};

export const statusOptions: Array<{ value: MarketStatus; label: string }> = [
  { value: "pending", label: statusLabels.pending },
  { value: "won", label: statusLabels.won },
  { value: "lost", label: statusLabels.lost },
  { value: "push", label: statusLabels.push },
  { value: "half_won", label: statusLabels.half_won },
  { value: "half_lost", label: statusLabels.half_lost },
  { value: "void", label: statusLabels.void },
];

export const categoryOptions = ["投注", "调整", "返还"] as const;

export type User = {
  id: string;
  username: string;
  display_name: string;
  system_role: SystemRole;
  disabled_at: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
};

export type Market = {
  id: string;
  group_id: string;
  project: string;
  content: string;
  category: string;
  event_date: string;
  event_time: string;
  status: MarketStatus;
  is_settled: boolean;
  odds: string;
  note: string | null;
  created_by_user_id: string;
  external_event_id: string | null;
  auto_settle: boolean;
  settlement_kind: "asian_handicap" | null;
  selection_team_id: string | null;
  selection_team_name: string | null;
  selection_home_away: "home" | "away" | null;
  handicap: string | null;
  settled_from_event_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  bet_count?: number;
  total_stake?: string | null;
  total_payout?: string | null;
  total_profit?: string | null;
};

export type ExternalEventStatusState = "pre" | "in" | "post";

export type ExternalEvent = {
  id: string;
  provider: string;
  external_id: string;
  uid: string | null;
  name: string;
  short_name: string | null;
  stage: string | null;
  venue: string | null;
  event_date: string;
  event_time: string;
  starts_at: string;
  status_state: ExternalEventStatusState;
  status_detail: string | null;
  completed: boolean;
  home_team_id: string | null;
  home_team_name: string;
  home_team_abbr: string | null;
  home_score: number | null;
  regular_time_home_score: number | null;
  away_team_id: string | null;
  away_team_name: string;
  away_team_abbr: string | null;
  away_score: number | null;
  regular_time_away_score: number | null;
  last_synced_at: string;
  linked_market_count?: number;
  skipped_at?: string | null;
  skipped_by_user_id?: string | null;
  skipped_by_name?: string | null;
};

export type DashboardCalendarEvent = {
  id: string;
  name: string;
  time: string | null;
  completed: boolean;
  status_state: ExternalEventStatusState;
  home_score: number | null;
  away_score: number | null;
  regular_time_home_score: number | null;
  regular_time_away_score: number | null;
  linked_market_count: number;
};

export type DashboardCalendarMarket = {
  id: string;
  project: string;
  content: string;
  time: string | null;
  status: MarketStatus;
  is_settled: boolean;
  stake: string;
  profit: string;
  bet_count: number;
};

export type DashboardCalendarDay = {
  event_date: string;
  event_count: number;
  completed_event_count: number;
  market_count: number;
  pending_count: number;
  won_count: number;
  lost_count: number;
  push_count: number;
  void_count: number;
  total_stake: string;
  total_profit: string;
  events: DashboardCalendarEvent[];
  markets: DashboardCalendarMarket[];
};

export type Bet = {
  id: string;
  market_id: string;
  user_id: string;
  stake: string;
  payout: string | null;
  profit: string | null;
  note: string | null;
  manual_payout: boolean;
  created_at: string;
  updated_at: string;
  username?: string;
  display_name?: string;
  project?: string;
  content?: string;
  category?: string;
  status?: MarketStatus;
  is_settled?: boolean;
  odds?: string;
  market_note?: string | null;
  auto_settle?: boolean;
  selection_team_name?: string | null;
  handicap?: string | null;
  event_date?: string;
  event_time?: string;
};

export type InviteCode = {
  id: string;
  code: string;
  created_by_user_id: string | null;
  group_id: string;
  role_on_signup: GroupRole;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  group_name?: string;
  creator_name?: string | null;
};
