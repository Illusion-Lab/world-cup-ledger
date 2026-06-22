"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";

import { syncWorldCupScheduleAction } from "@/app/actions/markets";
import { ScheduleEventsList } from "@/components/schedule-events-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExternalEvent } from "@/types/domain";

function latestSyncText(events: ExternalEvent[]) {
  const latest = events
    .map((event) => new Date(event.last_synced_at).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];
  if (!latest) return "尚未同步";
  return new Date(latest).toLocaleString("zh-CN", { hour12: false });
}

export function ScheduleClientPage({
  initialError,
  initialSynced,
}: {
  initialError?: string;
  initialSynced?: string;
}) {
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(initialError || "");

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      try {
        const response = await fetch("/api/schedule/events", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "赛程加载失败");
        if (!cancelled) {
          setEvents(payload);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "赛程加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => ({
      completedCount: events.filter((event) => event.completed).length,
      linkedCount: events.reduce(
        (sum, event) => sum + Number(event.linked_market_count ?? 0),
        0,
      ),
    }),
    [events],
  );

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">世界杯赛程</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            同步赛程和比分后，可以按比赛快速创建自动结算盘口。
          </p>
        </div>
        <form action={syncWorldCupScheduleAction}>
          <Button type="submit" size="sm" className="h-9 shrink-0 px-3">
            <RefreshCw className="h-4 w-4" />
            同步
          </Button>
        </form>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {initialSynced ? (
        <div className="rounded-md border border-[color:var(--geist-green-700)] bg-secondary px-3 py-2 text-sm text-foreground">
          {initialSynced}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>已同步比赛</CardDescription>
            <CardTitle>{loading ? "-" : events.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>已完赛</CardDescription>
            <CardTitle>{loading ? "-" : stats.completedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>已创建盘口</CardDescription>
            <CardTitle>{loading ? "-" : stats.linkedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>比赛列表</CardTitle>
          <CardDescription>
            {loading ? "正在加载" : `最近同步：${latestSyncText(events)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              正在加载赛程
            </div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center">
              <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-3 font-medium">还没有赛程数据</div>
              <p className="mt-1 text-sm text-muted-foreground">
                点击上方同步按钮，从数据源拉取世界杯赛程和当前比分。
              </p>
            </div>
          ) : (
            <ScheduleEventsList events={events} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
