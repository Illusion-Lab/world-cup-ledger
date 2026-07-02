"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { ArrowRight, Ban, ChevronDown, Eye, RotateCcw, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createMarketFromEventDialogAction,
  skipScheduleEventDialogAction,
  unskipScheduleEventDialogAction,
} from "@/app/actions/markets";
import { LoadingButton } from "@/components/loading-button";
import { NumberSliderField } from "@/components/number-slider-field";
import { SuccessHalfSheet } from "@/components/success-half-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExternalEvent } from "@/types/domain";

type EventFilter =
  | "active"
  | "all"
  | "pre"
  | "in"
  | "post"
  | "post-unlinked"
  | "linked"
  | "skipped";

const INITIAL_LIMIT = 24;

function EventStateBadge({ event }: { event: ExternalEvent }) {
  if (event.completed) return <Badge variant="default">已完赛</Badge>;
  if (event.status_state === "in") return <Badge variant="secondary">进行中</Badge>;
  return <Badge variant="outline">未开始</Badge>;
}

function scoreText(event: ExternalEvent) {
  if (
    event.regular_time_home_score !== null &&
    event.regular_time_home_score !== undefined &&
    event.regular_time_away_score !== null &&
    event.regular_time_away_score !== undefined
  ) {
    const regularScore = `${event.regular_time_home_score} - ${event.regular_time_away_score}`;
    const totalScore =
      event.home_score === null || event.away_score === null
        ? null
        : `${event.home_score} - ${event.away_score}`;

    if (totalScore && totalScore !== regularScore) return `常规 ${regularScore}`;
    return regularScore;
  }

  if (event.home_score === null || event.away_score === null) return "vs";
  return `${event.home_score} - ${event.away_score}`;
}

function compactDateLabel(dateValue: string) {
  const parts = dateValue.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : dateValue;
}

function compactDateText(event: ExternalEvent) {
  return `${compactDateLabel(event.event_date)} ${event.event_time}`;
}

function filterEvents(events: ExternalEvent[], filter: EventFilter) {
  if (filter === "active") return events.filter((event) => !event.completed);
  if (filter === "linked") {
    return events.filter((event) => Number(event.linked_market_count ?? 0) > 0);
  }
  if (filter === "skipped") return events.filter((event) => Boolean(event.skipped_at));
  if (filter === "post") return events.filter((event) => event.completed);
  if (filter === "post-unlinked") {
    return events.filter(
      (event) =>
        event.completed &&
        Number(event.linked_market_count ?? 0) === 0 &&
        !event.skipped_at,
    );
  }
  if (filter === "all") return events;
  return events.filter((event) => event.status_state === filter);
}

function canToggleSkip(event: ExternalEvent) {
  return event.completed && Number(event.linked_market_count ?? 0) === 0;
}

export function ScheduleEventsList({ events }: { events: ExternalEvent[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<EventFilter>("post-unlinked");
  const [dateFilter, setDateFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);
  const [selectedEvent, setSelectedEvent] = useState<ExternalEvent | null>(null);
  const [locallyLinkedEventIds, setLocallyLinkedEventIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [localSkippedEvents, setLocalSkippedEvents] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [nextEventToCreate, setNextEventToCreate] = useState<ExternalEvent | null>(null);
  const [createdMarketId, setCreatedMarketId] = useState("");
  const [createError, setCreateError] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [skipPendingEventId, setSkipPendingEventId] = useState("");
  const [skipError, setSkipError] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const effectiveEvents = useMemo(
    () =>
      events.map((event) => {
        const localSkipped = localSkippedEvents.get(event.id);
        const linkedEvent = locallyLinkedEventIds.has(event.id)
          ? {
              ...event,
              linked_market_count: Number(event.linked_market_count ?? 0) + 1,
              skipped_at: null,
              skipped_by_user_id: null,
              skipped_by_name: null,
            }
          : event;

        if (localSkipped === undefined) return linkedEvent;
        return {
          ...linkedEvent,
          skipped_at: localSkipped ? new Date().toISOString() : null,
          skipped_by_user_id: localSkipped ? linkedEvent.skipped_by_user_id : null,
          skipped_by_name: localSkipped ? "你" : null,
        };
      }),
    [events, locallyLinkedEventIds, localSkippedEvents],
  );
  const completedCount = useMemo(
    () => effectiveEvents.filter((event) => event.completed).length,
    [effectiveEvents],
  );
  const skippedCount = useMemo(
    () => effectiveEvents.filter((event) => event.skipped_at).length,
    [effectiveEvents],
  );

  const statusFilteredEvents = useMemo(
    () => filterEvents(effectiveEvents, filter),
    [effectiveEvents, filter],
  );
  const dateGroups = useMemo(() => {
    const groups = new Map<string, { count: number; date: string; label: string }>();

    for (const event of statusFilteredEvents) {
      const existingGroup = groups.get(event.event_date);

      if (existingGroup) {
        existingGroup.count += 1;
      } else {
        groups.set(event.event_date, {
          count: 1,
          date: event.event_date,
          label: compactDateLabel(event.event_date),
        });
      }
    }

    return Array.from(groups.values());
  }, [statusFilteredEvents]);
  const filteredEvents = useMemo(() => {
    if (dateFilter === "all") return statusFilteredEvents;
    return statusFilteredEvents.filter((event) => event.event_date === dateFilter);
  }, [dateFilter, statusFilteredEvents]);
  const visibleEvents = filteredEvents.slice(0, visibleCount);

  function changeFilter(value: string) {
    setFilter(value as EventFilter);
    setDateFilter("all");
    setVisibleCount(INITIAL_LIMIT);
  }

  function changeDateFilter(value: string) {
    setDateFilter(value);
    setVisibleCount(INITIAL_LIMIT);
  }

  function submitEventMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending || !selectedEvent) return;

    const formData = new FormData(event.currentTarget);
    const eventBeingCreated = selectedEvent;
    const currentIndex = filteredEvents.findIndex((event) => event.id === eventBeingCreated.id);
    const nextEvent =
      filteredEvents.slice(currentIndex + 1).find((event) => event.id !== eventBeingCreated.id) ??
      filteredEvents.find((event) => event.id !== eventBeingCreated.id) ??
      null;

    setCreateError("");
    setCreatePending(true);

    startTransition(() => {
      void createMarketFromEventDialogAction(formData)
        .then((result) => {
          if (!result.ok) {
            setCreateError(result.error);
            setCreatePending(false);
            return;
          }

          setCreatedMarketId(result.id ?? "");
          setNextEventToCreate(nextEvent);
          setLocallyLinkedEventIds((current) => {
            const next = new Set(current);
            next.add(eventBeingCreated.id);
            return next;
          });
          setLocalSkippedEvents((current) => {
            const next = new Map(current);
            next.set(eventBeingCreated.id, false);
            return next;
          });
          setSelectedEvent(null);
          setSuccessOpen(true);
          setCreatePending(false);
        })
        .catch(() => {
          setCreateError("操作失败");
          setCreatePending(false);
        });
    });
  }

  function updateEventSkip(event: ExternalEvent, skipped: boolean) {
    if (skipPendingEventId) return;

    const formData = new FormData();
    formData.set("externalEventId", event.id);
    setSkipError("");
    setSkipPendingEventId(event.id);

    const action = skipped ? skipScheduleEventDialogAction : unskipScheduleEventDialogAction;

    startTransition(() => {
      void action(formData)
        .then((result) => {
          if (!result.ok) {
            setSkipError(result.error);
            setSkipPendingEventId("");
            return;
          }

          setLocalSkippedEvents((current) => {
            const next = new Map(current);
            next.set(event.id, skipped);
            return next;
          });
          setSkipPendingEventId("");
          router.refresh();
        })
        .catch(() => {
          setSkipError("操作失败");
          setSkipPendingEventId("");
        });
    });
  }

  function openNextEvent() {
    if (!nextEventToCreate) return;
    setSuccessOpen(false);
    setCreateError("");
    setCreatedMarketId("");
    setSelectedEvent(nextEventToCreate);
    setNextEventToCreate(null);
  }

  function viewCreatedMarket() {
    if (!createdMarketId) return;
    router.push(`/markets/${createdMarketId}`);
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={filter} onChange={(event) => changeFilter(event.target.value)}>
          <option value="active">未结束比赛</option>
          <option value="all">全部比赛</option>
          <option value="pre">未开始</option>
          <option value="in">进行中</option>
          <option value="post">已完赛</option>
          <option value="post-unlinked">已完赛未建盘口</option>
          <option value="linked">已建盘口</option>
          <option value="skipped">已跳过</option>
        </Select>
        <div className="text-xs text-muted-foreground sm:text-sm">
          {visibleEvents.length} / {filteredEvents.length}
          {filter === "active" && completedCount > 0 ? `，已收起 ${completedCount} 场已完赛` : ""}
          {filter === "post-unlinked" && skippedCount > 0 ? `，已跳过 ${skippedCount} 场` : ""}
        </div>
      </div>

      {skipError ? (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {skipError}
        </div>
      ) : null}

      <div className="mb-3 grid gap-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Button
            type="button"
            variant={dateFilter === "all" ? "default" : "outline"}
            size="sm"
            className="h-8 shrink-0 rounded-md px-3 text-xs"
            onClick={() => changeDateFilter("all")}
          >
            全部日期
            <span className="text-[11px] opacity-70">{statusFilteredEvents.length}</span>
          </Button>
          {dateGroups.map((group) => (
            <Button
              key={group.date}
              type="button"
              variant={dateFilter === group.date ? "default" : "outline"}
              size="sm"
              className="h-8 shrink-0 rounded-md px-3 text-xs"
              onClick={() => changeDateFilter(group.date)}
            >
              {group.label}
              <span className="text-[11px] opacity-70">{group.count}</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        {visibleEvents.map((event) => (
          <div key={event.id} className="-mx-3 border-b px-3 py-3 last:border-b-0 sm:py-4">
            <div className="grid gap-2 sm:gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 overflow-hidden sm:flex-wrap sm:gap-2">
                  <EventStateBadge event={event} />
                  {event.linked_market_count ? (
                    <Badge variant="secondary" className="shrink-0">
                      {event.linked_market_count} 个盘口
                    </Badge>
                  ) : null}
                  {event.skipped_at ? (
                    <Badge variant="outline" className="shrink-0">
                      已跳过
                    </Badge>
                  ) : null}
                  {event.stage ? (
                    <Badge variant="outline" className="min-w-0 truncate">
                      {event.stage}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:mt-4 sm:gap-3">
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold sm:text-lg">
                      {event.home_team_name}
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-sm">
                      {event.home_team_abbr ?? "主队"}
                    </div>
                  </div>
                  <div className="flex h-9 min-w-16 items-center justify-center rounded-md bg-secondary px-2 text-sm font-semibold sm:h-12 sm:min-w-24 sm:px-4 sm:text-lg">
                    {scoreText(event)}
                  </div>
                  <div className="min-w-0 text-right">
                    <div className="truncate text-sm font-semibold sm:text-lg">
                      {event.away_team_name}
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-sm">
                      {event.away_team_abbr ?? "客队"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:mt-4 sm:grid sm:grid-cols-3 sm:gap-2 sm:text-sm">
                  <div className="shrink-0">{compactDateText(event)}</div>
                  <div className="truncate">{event.status_detail ?? "待开赛"}</div>
                  <div className="hidden truncate sm:block sm:text-right">
                    {event.venue ?? "场地待定"}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 w-full sm:h-9 xl:w-auto"
                  onClick={() => setSelectedEvent(event)}
                >
                  <Trophy className="h-4 w-4" />
                  创建盘口
                </Button>
                {canToggleSkip(event) ? (
                  event.skipped_at ? (
                    <LoadingButton
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full sm:h-9 xl:w-auto"
                      loading={skipPendingEventId === event.id}
                      loadingText="恢复中"
                      onClick={() => updateEventSkip(event, false)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      恢复显示
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full sm:h-9 xl:w-auto"
                      loading={skipPendingEventId === event.id}
                      loadingText="跳过中"
                      onClick={() => updateEventSkip(event, true)}
                    >
                      <Ban className="h-4 w-4" />
                      跳过
                    </LoadingButton>
                  )
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {visibleCount < filteredEvents.length ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((count) => count + INITIAL_LIMIT)}
          >
            <ChevronDown className="h-4 w-4" />
            加载更多
          </Button>
        </div>
      ) : null}

      <Dialog
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => {
          if (createPending) return;
          if (!open) {
            setSelectedEvent(null);
            setCreateError("");
          }
        }}
      >
        <DialogContent>
          {selectedEvent ? (
            <>
              <DialogHeader>
                <DialogTitle>创建盘口</DialogTitle>
                <DialogDescription>
                  {selectedEvent.home_team_name} vs {selectedEvent.away_team_name}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitEventMarket} className="grid gap-4">
                <input type="hidden" name="externalEventId" value={selectedEvent.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="selectionHomeAway">球队</Label>
                    <Select id="selectionHomeAway" name="selectionHomeAway" defaultValue="away">
                      <option value="home">{selectedEvent.home_team_name}</option>
                      <option value="away">{selectedEvent.away_team_name}</option>
                    </Select>
                  </div>
                  <NumberSliderField
                    name="handicap"
                    label="盘口值"
                    defaultValue="0"
                    min={-5}
                    max={5}
                    step={0.25}
                    placeholder="填写数值"
                  />
                </div>
                <NumberSliderField
                  name="odds"
                  label="赔率"
                  defaultValue="2"
                  min={1}
                  max={6}
                  step={0.001}
                  placeholder="填写数值"
                  required
                />
                <div className="grid gap-2">
                  <Label htmlFor="note">备注</Label>
                  <Textarea id="note" name="note" placeholder="填写备注" />
                </div>
                {createError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {createError}
                  </div>
                ) : null}
                <LoadingButton type="submit" loading={createPending} loadingText="创建中">
                  <Trophy className="h-4 w-4" />
                  创建盘口
                </LoadingButton>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <SuccessHalfSheet
        open={successOpen}
        title="盘口已创建"
        description={
          nextEventToCreate
            ? `${nextEventToCreate.home_team_name} vs ${nextEventToCreate.away_team_name} 可以继续录入`
            : "当前筛选下已经没有下一场未建盘口比赛"
        }
      >
        <div className="grid gap-2">
          {nextEventToCreate ? (
            <Button type="button" onClick={openNextEvent}>
              <ArrowRight className="h-4 w-4" />
              继续录下一场
            </Button>
          ) : null}
          {createdMarketId ? (
            <Button type="button" variant="outline" onClick={viewCreatedMarket}>
              <Eye className="h-4 w-4" />
              查看盘口
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setSuccessOpen(false)}>
            留在赛程
          </Button>
        </div>
      </SuccessHalfSheet>
    </>
  );
}
