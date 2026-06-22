import Link from "next/link";
import { Plus } from "lucide-react";

import { DashboardCalendarBoard } from "@/components/dashboard-calendar-board";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDashboardSummary } from "@/lib/api-data";
import { formatMoney, formatPercent } from "@/lib/utils";
import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  const summary = await getDashboardSummary(user.group!.id, user.id);
  const groupStats = summary.groupStats;
  const myStats = summary.myStats;
  const myStake = Number(myStats.total_stake || 0);
  const myProfit = Number(myStats.total_profit || 0);
  const roi = myStake > 0 ? myProfit / myStake : null;

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">仪表盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.group?.name}，当前用户 {user.display_name}
          </p>
        </div>
        <Button asChild size="sm" className="h-9 shrink-0 px-3">
          <Link href="/markets?new=1">
            <Plus className="h-4 w-4" />
            新增盘口
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>我的投入</CardDescription>
            <CardTitle>{formatMoney(myStats.total_stake)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>我的盈亏</CardDescription>
            <CardTitle className={myProfit >= 0 ? "text-[var(--geist-green-700)]" : "text-destructive"}>
              {formatMoney(myStats.total_profit)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>我的 ROI</CardDescription>
            <CardTitle>{formatPercent(roi)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>待判定投入</CardDescription>
            <CardTitle>{formatMoney(myStats.pending_stake)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>账本盘口</CardDescription>
            <CardTitle>{groupStats.market_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>账本投注</CardDescription>
            <CardTitle>{groupStats.bet_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>账本总盈亏</CardDescription>
            <CardTitle>{formatMoney(groupStats.total_profit)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <DashboardCalendarBoard days={summary.calendarDays ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>最近盘口</CardTitle>
          <CardDescription>共享盘口只创建一次，每个人在详情页记录自己的投注。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>投注内容</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>投入</TableHead>
                  <TableHead>盈亏</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recentMarkets.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell>{market.project}</TableCell>
                    <TableCell>{market.content}</TableCell>
                    <TableCell>
                      <StatusBadge status={market.status} />
                    </TableCell>
                    <TableCell>{formatMoney(market.total_stake)}</TableCell>
                    <TableCell>{formatMoney(market.total_profit)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/markets/${market.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden">
            {summary.recentMarkets.map((market) => (
              <Link
                key={market.id}
                href={`/markets/${market.id}`}
                className="-mx-3 block border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-accent/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{market.project}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{market.content}</div>
                  </div>
                  <StatusBadge status={market.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>投入 {formatMoney(market.total_stake)}</div>
                  <div>盈亏 {formatMoney(market.total_profit)}</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
