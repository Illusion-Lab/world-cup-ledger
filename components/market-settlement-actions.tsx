"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  updateMarketDaySettlementDialogAction,
  updateMarketSettlementDialogAction,
} from "@/app/actions/markets";
import { LoadingButton } from "@/components/loading-button";
import { SuccessHalfSheet } from "@/components/success-half-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SettlementActionResult =
  | { ok: true; count?: number }
  | { ok: false; error: string };

export function SettlementBadge({
  isSettled,
  className,
}: {
  isSettled: boolean;
  className?: string;
}) {
  return (
    <Badge variant={isSettled ? "success" : "outline"} className={cn("whitespace-nowrap", className)}>
      {isSettled ? "已入账" : "未入账"}
    </Badge>
  );
}

function ActionError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

function useSettlementSubmission({
  action,
  successTitle,
}: {
  action: (formData: FormData) => Promise<SettlementActionResult>;
  successTitle: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successDescription, setSuccessDescription] = useState("");

  function submit(formData: FormData, description: (result: SettlementActionResult) => string) {
    if (pending) return;
    setError("");
    setPending(true);

    startTransition(() => {
      void action(formData)
        .then((result) => {
          if (!result.ok) {
            setError(result.error);
            setPending(false);
            return;
          }
          setSuccessDescription(description(result));
          setSuccessOpen(true);
          setPending(false);
          router.refresh();
        })
        .catch(() => {
          setError("操作失败");
          setPending(false);
        });
    });
  }

  return {
    error,
    pending,
    submit,
    successSheet: (
      <SuccessHalfSheet
        open={successOpen}
        title={successTitle}
        description={successDescription}
      >
        <Button variant="outline" onClick={() => setSuccessOpen(false)} className="w-full">
          留在当前页面
        </Button>
      </SuccessHalfSheet>
    ),
  };
}

export function MarketSettlementAction({
  marketId,
  isSettled,
  canEdit,
  compact = false,
}: {
  marketId: string;
  isSettled: boolean;
  canEdit: boolean;
  compact?: boolean;
}) {
  const nextSettled = !isSettled;
  const submission = useSettlementSubmission({
    action: updateMarketSettlementDialogAction,
    successTitle: nextSettled ? "盘口已入账" : "盘口已撤销入账",
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submission.submit(new FormData(event.currentTarget), () =>
      nextSettled ? "该盘口已标记为已入账" : "该盘口已标记为未入账",
    );
  }

  if (!canEdit) return <SettlementBadge isSettled={isSettled} />;

  return (
    <>
      <form onSubmit={onSubmit} className={compact ? "inline-flex" : "flex flex-col gap-2"}>
        <input type="hidden" name="marketId" value={marketId} />
        <input type="hidden" name="isSettled" value={String(nextSettled)} />
        <LoadingButton
          type="submit"
          variant={isSettled ? "outline" : "default"}
          size="sm"
          loading={submission.pending}
          loadingText={isSettled ? "撤销中" : "入账中"}
          className={compact ? "h-8 px-2 text-xs" : ""}
        >
          {isSettled ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {isSettled ? "撤销入账" : "标记入账"}
        </LoadingButton>
        <ActionError message={submission.error} />
      </form>
      {submission.successSheet}
    </>
  );
}

export function DaySettlementActions({
  dates,
  disabled = false,
}: {
  dates: string[];
  disabled?: boolean;
}) {
  const uniqueDates = useMemo(() => Array.from(new Set(dates)).filter(Boolean), [dates]);
  const [selectedDate, setSelectedDate] = useState(uniqueDates[0] ?? "");
  const [targetSettled, setTargetSettled] = useState(true);
  const submission = useSettlementSubmission({
    action: updateMarketDaySettlementDialogAction,
    successTitle: targetSettled ? "当天盘口已入账" : "当天盘口已撤销入账",
  });
  const unavailable = disabled || uniqueDates.length === 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submission.submit(new FormData(event.currentTarget), (result) => {
      const count = result.ok ? result.count ?? 0 : 0;
      return `已更新 ${count} 个盘口`;
    });
  }

  return (
    <>
      <form className="grid gap-2 md:grid-cols-[180px_150px_auto]" onSubmit={onSubmit}>
        <Select
          name="eventDate"
          value={selectedDate}
          disabled={unavailable || submission.pending}
          onChange={(event) => setSelectedDate(event.target.value)}
        >
          {uniqueDates.length > 0 ? (
            uniqueDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))
          ) : (
            <option value="">暂无日期</option>
          )}
        </Select>
        <Select
          name="isSettled"
          value={String(targetSettled)}
          disabled={unavailable || submission.pending}
          onChange={(event) => setTargetSettled(event.target.value === "true")}
        >
          <option value="true">标记已入账</option>
          <option value="false">标记未入账</option>
        </Select>
        <LoadingButton
          type="submit"
          loading={submission.pending}
          loadingText="处理中"
          disabled={unavailable}
          className="w-full md:w-auto"
        >
          批量处理
        </LoadingButton>
        <div className="md:col-span-3">
          <ActionError message={submission.error} />
        </div>
      </form>
      {submission.successSheet}
    </>
  );
}
