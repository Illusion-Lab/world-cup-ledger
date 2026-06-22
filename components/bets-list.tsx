"use client";

import Link from "next/link";
import { Check, Copy, X } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatEventDateTime, formatMoney } from "@/lib/utils";
import { statusLabels, type Bet } from "@/types/domain";

type BetsListProps = {
  bets: Bet[];
};

type DateGroup = {
  key: string;
  label: string;
  betIds: string[];
};

function toAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function fieldValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function compactDateLabel(value: string) {
  const parts = value.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : value;
}

function buildBetText(
  bets: Bet[],
  totals: {
    stake: number;
    payout: number;
    profit: number;
    pendingCount: number;
    pendingStake: number;
  },
) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const lines = [
    "世界杯账本｜投注明细",
    `已选：${bets.length} 场`,
    `汇总：投入 ${formatMoney(totals.stake)}，已结算产出 ${formatMoney(totals.payout)}，已结算盈亏 ${formatMoney(totals.profit)}，待结算 ${totals.pendingCount} 场 / ${formatMoney(totals.pendingStake)}`,
    "",
  ];

  bets.forEach((bet, index) => {
    lines.push(`${index + 1}. ${fieldValue(bet.project)}`);
    lines.push(`比赛时间：${formatEventDateTime(bet.event_date, bet.event_time)}`);
    lines.push(`盘口：${fieldValue(bet.content)}`);
    lines.push(`分类：${fieldValue(bet.category)}`);
    lines.push(`状态：${bet.status ? statusLabels[bet.status] : "-"}`);
    lines.push(`赔率：${fieldValue(bet.odds)}`);
    if (bet.selection_team_name || bet.handicap) {
      lines.push(`球队/盘口值：${fieldValue(bet.selection_team_name)} ${fieldValue(bet.handicap)}`);
    }
    lines.push(`自动结算：${fieldValue(bet.auto_settle)}`);
    lines.push(`我的投入：${formatMoney(bet.stake)}`);
    lines.push(`我的产出：${formatMoney(bet.payout)}`);
    lines.push(`我的盈亏：${formatMoney(bet.profit)}`);
    if (bet.market_note) lines.push(`盘口备注：${bet.market_note}`);
    if (bet.note) lines.push(`我的备注：${bet.note}`);
    if (origin) lines.push(`详情：${origin}/markets/${bet.market_id}`);
    if (index < bets.length - 1) lines.push("");
  });

  return lines.join("\n");
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function BetsList({ bets }: BetsListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const dateGroups = useMemo(() => {
    const groups = new Map<string, DateGroup>();
    for (const bet of bets) {
      const key = bet.event_date?.trim() || "未设置日期";
      const group = groups.get(key);
      if (group) {
        group.betIds.push(bet.id);
      } else {
        groups.set(key, {
          key,
          label: compactDateLabel(key),
          betIds: [bet.id],
        });
      }
    }
    return Array.from(groups.values());
  }, [bets]);

  const selectedBets = useMemo(
    () => bets.filter((bet) => selectedIds.has(bet.id)),
    [bets, selectedIds],
  );
  const selectedCount = selectedBets.length;

  const totals = useMemo(() => {
    return selectedBets.reduce(
      (sum, bet) => {
        const stake = toAmount(bet.stake);
        const payout = bet.payout === null ? null : toAmount(bet.payout);
        const profit = bet.profit === null ? null : toAmount(bet.profit);
        sum.stake += stake;
        if (payout === null || profit === null) {
          sum.pendingCount += 1;
          sum.pendingStake += stake;
        } else {
          sum.payout += payout;
          sum.profit += profit;
        }
        return sum;
      },
      {
        stake: 0,
        payout: 0,
        profit: 0,
        pendingCount: 0,
        pendingStake: 0,
      },
    );
  }, [selectedBets]);

  function toggleBet(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleDateGroup(group: DateGroup) {
    setSelectedIds((current) => {
      const next = new Set(current);
      const groupSelected = group.betIds.every((id) => next.has(id));
      for (const id of group.betIds) {
        if (groupSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function copySelectedBets() {
    if (selectedBets.length === 0) return;
    try {
      await copyText(buildBetText(selectedBets, totals));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  return (
    <div className="grid max-w-full gap-2 overflow-hidden sm:gap-4">
      <div className="grid gap-2 border-b pb-2 sm:pb-4">
        <div className="text-xs font-medium sm:text-sm">按日期选择</div>
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:gap-2">
          {dateGroups.map((group) => {
            const selectedInGroup = group.betIds.filter((id) => selectedIds.has(id)).length;
            const groupSelected = selectedInGroup === group.betIds.length;
            const partlySelected = selectedInGroup > 0 && !groupSelected;

            return (
              <Button
                key={group.key}
                type="button"
                variant={groupSelected ? "default" : partlySelected ? "secondary" : "outline"}
                size="sm"
                className="h-8 shrink-0 rounded-md px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                onClick={() => toggleDateGroup(group)}
                title={group.key}
              >
                {groupSelected ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
                {group.label}
                <span className="text-xs opacity-70">{group.betIds.length}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="border-b pb-2 sm:pb-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-5 gap-1.5 text-[11px] sm:gap-3 sm:text-sm">
            <div className="min-w-0">
              <div className="text-muted-foreground">已选</div>
              <div className="font-medium">{selectedCount}</div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">投入</div>
              <div className="font-medium">{formatMoney(totals.stake)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">产出</div>
              <div className="font-medium">{formatMoney(totals.payout)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">
                <span className="sm:hidden">盈亏</span>
                <span className="hidden sm:inline">已结算盈亏</span>
              </div>
              <div
                className={cn(
                  "font-medium",
                  totals.profit > 0 && "text-[var(--geist-green-700)]",
                  totals.profit < 0 && "text-destructive",
                )}
              >
                {formatMoney(totals.profit)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">待结算</div>
              <div className="font-medium">
                {totals.pendingCount} / {formatMoney(totals.pendingStake)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 sm:h-9"
              onClick={copySelectedBets}
              disabled={selectedCount === 0}
            >
              {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyStatus === "copied" ? "已复制" : copyStatus === "failed" ? "失败" : "复制"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 sm:h-9"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedCount === 0}
            >
              <X className="h-4 w-4" />
              清空
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>项目</TableHead>
              <TableHead>投注内容</TableHead>
              <TableHead>比赛时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>赔率</TableHead>
              <TableHead>投入</TableHead>
              <TableHead>产出</TableHead>
              <TableHead>盈亏</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bets.map((bet) => {
              const selected = selectedIds.has(bet.id);
              return (
                <TableRow key={bet.id} data-state={selected ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`选择 ${bet.project ?? "投注"}`}
                      checked={selected}
                      onChange={() => toggleBet(bet.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                  </TableCell>
                  <TableCell>{bet.project}</TableCell>
                  <TableCell>{bet.content}</TableCell>
                  <TableCell>{formatEventDateTime(bet.event_date, bet.event_time)}</TableCell>
                  <TableCell>{bet.status ? <StatusBadge status={bet.status} /> : null}</TableCell>
                  <TableCell>{bet.odds}</TableCell>
                  <TableCell>{formatMoney(bet.stake)}</TableCell>
                  <TableCell>{formatMoney(bet.payout)}</TableCell>
                  <TableCell>{formatMoney(bet.profit)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/markets/${bet.market_id}`}>编辑</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {bets.map((bet) => {
          const selected = selectedIds.has(bet.id);
          return (
            <div
              key={bet.id}
              className={cn(
                "border-b py-2 transition-colors last:border-b-0 sm:py-2.5",
                selected ? "bg-secondary" : "hover:bg-accent/70",
              )}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`选择 ${bet.project ?? "投注"}`}
                  checked={selected}
                  onChange={() => toggleBet(bet.id)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-input"
                />
                <Link href={`/markets/${bet.market_id}`} className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{bet.project}</div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{bet.content}</span>
                        <span className="shrink-0">赔率 {bet.odds}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatEventDateTime(bet.event_date, bet.event_time)}
                      </div>
                    </div>
                    {bet.status ? <StatusBadge status={bet.status} /> : null}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">投入</div>
                      <div className="font-medium">{formatMoney(bet.stake)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">产出</div>
                      <div className="font-medium">{formatMoney(bet.payout)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">盈亏</div>
                      <div className="font-medium">{formatMoney(bet.profit)}</div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
