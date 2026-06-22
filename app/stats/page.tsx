import { StatusBadge } from "@/components/status-badge";
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
import { requireUser } from "@/lib/auth";
import { getStats } from "@/lib/api-data";
import { formatMoney, formatPercent } from "@/lib/utils";
import type { MarketStatus } from "@/types/domain";

export default async function StatsPage() {
  const user = await requireUser();
  const stats = await getStats(user.group!.id);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">统计</h1>
        <p className="mt-1 text-sm text-muted-foreground">按用户、状态和分类统计共享账本表现。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户排行</CardTitle>
          <CardDescription>ROI = 已结算盈亏 / 总投入。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>投注数</TableHead>
                <TableHead>总投入</TableHead>
                <TableHead>待结算</TableHead>
                <TableHead>盈亏</TableHead>
                <TableHead>ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byUser.map((row) => {
                const stake = Number(row.total_stake);
                const profit = Number(row.total_profit);
                return (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <div className="font-medium">{row.display_name}</div>
                      <div className="text-xs text-muted-foreground">@{row.username}</div>
                    </TableCell>
                    <TableCell>{row.bet_count}</TableCell>
                    <TableCell>{formatMoney(row.total_stake)}</TableCell>
                    <TableCell>{formatMoney(row.pending_stake)}</TableCell>
                    <TableCell>{formatMoney(row.total_profit)}</TableCell>
                    <TableCell>{formatPercent(stake > 0 ? profit / stake : null)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>按状态</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状态</TableHead>
                  <TableHead>盘口</TableHead>
                  <TableHead>投入</TableHead>
                  <TableHead>盈亏</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byStatus.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <StatusBadge status={row.status as MarketStatus} />
                    </TableCell>
                    <TableCell>{row.market_count}</TableCell>
                    <TableCell>{formatMoney(row.total_stake)}</TableCell>
                    <TableCell>{formatMoney(row.total_profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>按分类</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分类</TableHead>
                  <TableHead>盘口</TableHead>
                  <TableHead>投入</TableHead>
                  <TableHead>盈亏</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byCategory.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.market_count}</TableCell>
                    <TableCell>{formatMoney(row.total_stake)}</TableCell>
                    <TableCell>{formatMoney(row.total_profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
