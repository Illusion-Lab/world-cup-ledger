import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import type { DashboardCalendarDay, DashboardCalendarEvent } from "@/types/domain";

type CalendarCell = {
  key: string;
  day?: DashboardCalendarDay;
  isToday: boolean;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function formatMonthDay(key: string) {
  const [, month, day] = key.split("-").map(Number);
  return `${month}/${day}`;
}

function buildCalendarCells(days: DashboardCalendarDay[]) {
  if (days.length === 0) return [];

  const dayMap = new Map(days.map((day) => [day.event_date, day]));
  const firstDate = parseDateKey(days[0].event_date);
  const lastDate = parseDateKey(days[days.length - 1].event_date);
  const start = addDays(firstDate, -mondayIndex(firstDate));
  const end = addDays(lastDate, 6 - mondayIndex(lastDate));
  const todayKey = toDateKey(new Date());
  const cells: CalendarCell[] = [];

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    cells.push({
      key,
      day: dayMap.get(key),
      isToday: key === todayKey,
    });
  }

  return cells;
}

function eventScore(event: DashboardCalendarEvent) {
  if (!event.completed || event.home_score === null || event.away_score === null) return "";
  return ` ${event.home_score}-${event.away_score}`;
}

function profitClass(value: number) {
  if (value > 0) return "text-[var(--geist-green-700)]";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

function CalendarDayCell({ cell, index }: { cell: CalendarCell; index: number }) {
  const day = cell.day;
  const events = day?.events ?? [];
  const markets = day?.markets ?? [];
  const profit = Number(day?.total_profit ?? 0);
  const settledCount = day
    ? day.won_count + day.lost_count + day.push_count + day.void_count
    : 0;
  const neutralCount = day ? day.push_count + day.void_count : 0;
  const eventItems = events.slice(0, 2);
  const marketItems = events.length ? [] : markets.slice(0, 2);

  return (
    <div
      className={cn(
        "min-h-[88px] p-1.5 sm:min-h-[164px] sm:p-3",
        index >= 7 && "border-t",
        index % 7 !== 6 && "border-r",
        !day && "bg-secondary/30 text-muted-foreground",
        cell.isToday && "bg-secondary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold sm:text-sm">{formatMonthDay(cell.key)}</div>
        {cell.isToday ? <Badge variant="outline" className="hidden sm:inline-flex">今天</Badge> : null}
      </div>

      {day ? (
        <>
          <div className="mt-1 grid gap-1 text-[10px] leading-4 sm:mt-2 sm:flex sm:flex-wrap sm:text-[11px]">
            <span className="truncate rounded-md bg-secondary px-1 py-0.5 sm:px-1.5">
              {day.event_count}赛程
            </span>
            <span className="truncate rounded-md bg-secondary px-1 py-0.5 sm:px-1.5">
              {day.market_count}盘口
            </span>
          </div>

          <div className="mt-1 flex flex-wrap gap-1 sm:mt-2">
            {day.won_count ? (
              <Badge variant="success" className="px-1 text-[10px] leading-3 sm:px-2 sm:text-xs sm:leading-4">
                赢{day.won_count}
              </Badge>
            ) : null}
            {day.lost_count ? (
              <Badge variant="destructive" className="px-1 text-[10px] leading-3 sm:px-2 sm:text-xs sm:leading-4">
                输{day.lost_count}
              </Badge>
            ) : null}
            {neutralCount ? <Badge variant="secondary" className="hidden sm:inline-flex">走 {neutralCount}</Badge> : null}
            {day.pending_count ? <Badge variant="warning" className="hidden sm:inline-flex">待 {day.pending_count}</Badge> : null}
          </div>

          <div className="mt-1 grid gap-0.5 rounded-md bg-secondary px-1 py-1 text-[10px] sm:mt-2 sm:grid-cols-2 sm:gap-1 sm:px-2 sm:text-xs">
            <div>
              <span className="hidden text-muted-foreground sm:inline">投入</span>{" "}
              <span className="font-medium">{formatMoney(day.total_stake)}</span>
            </div>
            <div>
              <span className="hidden text-muted-foreground sm:inline">盈亏</span>{" "}
              <span className={cn("font-medium", profitClass(profit))}>
                {formatMoney(day.total_profit)}
              </span>
            </div>
          </div>

          <div className="mt-2 hidden space-y-1 sm:block">
            {eventItems.map((event) => (
              <div key={event.id} className="truncate text-xs text-muted-foreground">
                {event.time ? <span className="font-mono">{event.time}</span> : null} {event.name}
                {eventScore(event)}
              </div>
            ))}
            {marketItems.map((market) => (
              <Link
                key={market.id}
                href={`/markets/${market.id}`}
                className="block truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {market.time ? <span className="font-mono">{market.time}</span> : null}{" "}
                {market.project}
              </Link>
            ))}
            {day.event_count > eventItems.length ? (
              <div className="text-xs text-muted-foreground">
                另有 {day.event_count - eventItems.length} 场
              </div>
            ) : null}
            {day.event_count === 0 && day.market_count === 0 ? (
              <div className="text-xs text-muted-foreground">暂无赛程</div>
            ) : null}
            {day.event_count > 0 && day.market_count === 0 ? (
              <div className="text-xs text-muted-foreground">未建盘口</div>
            ) : null}
            {settledCount === 0 && day.pending_count > 0 ? (
              <div className="text-xs text-muted-foreground">等待结算</div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-6 text-center text-[10px] sm:mt-8 sm:text-xs">暂无</div>
      )}
    </div>
  );
}

export function DashboardCalendarBoard({ days = [] }: { days?: DashboardCalendarDay[] }) {
  const cells = buildCalendarCells(days);
  const totals = days.reduce(
    (acc, day) => {
      acc.events += day.event_count;
      acc.markets += day.market_count;
      acc.profit += Number(day.total_profit || 0);
      return acc;
    },
    { events: 0, markets: 0, profit: 0 },
  );

  return (
    <section className="grid gap-4 border-t pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold leading-6">日历看板</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            按比赛日期查看赛程、盘口和全账本输赢。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{totals.events} 场赛程</Badge>
          <Badge variant="outline">{totals.markets} 个盘口</Badge>
          <Badge variant="outline" className={profitClass(totals.profit)}>
            盈亏 {formatMoney(totals.profit)}
          </Badge>
        </div>
      </div>
      {cells.length ? (
        <div className="overflow-hidden pb-1 md:overflow-x-auto">
          <div className="min-w-0 md:min-w-[780px]">
            <div className="grid grid-cols-7 border bg-background">
              {WEEKDAYS.map((weekday, index) => (
                <div
                  key={weekday}
                  className={cn(
                    "bg-accent px-1 py-1.5 text-[10px] font-medium text-muted-foreground sm:px-3 sm:py-2 sm:text-xs",
                    index !== 6 && "border-r",
                  )}
                >
                  周{weekday}
                </div>
              ))}
              {cells.map((cell, index) => (
                <CalendarDayCell key={cell.key} cell={cell} index={index + 7} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-6 text-sm text-muted-foreground">暂无可展示的赛程或盘口。</div>
      )}
    </section>
  );
}
