import Link from "next/link";
import { Search } from "lucide-react";

import { CreateMarketDialog } from "@/components/market-action-dialogs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMarkets } from "@/lib/api-data";
import { formatEventDateTime, formatMoney } from "@/lib/utils";
import { requireUser } from "@/lib/auth";
import { statusOptions } from "@/types/domain";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; new?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const markets = await getMarkets(user.group!.id, params.q || "", params.status || "");

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">盘口</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            同一个盘口只建一条，成员在详情页各自记录投注。
          </p>
        </div>
        <CreateMarketDialog defaultOpen={params.new === "1"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>盘口列表</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]" action="/markets">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={params.q} className="pl-9" placeholder="搜索关键词" />
            </div>
            <Select name="status" defaultValue={params.status || ""}>
              <option value="">全部状态</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>投注内容</TableHead>
                  <TableHead>比赛时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>赔率</TableHead>
                  <TableHead>参与</TableHead>
                  <TableHead>总投入</TableHead>
                  <TableHead>总盈亏</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markets.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell>{market.project}</TableCell>
                    <TableCell>{market.content}</TableCell>
                    <TableCell>{formatEventDateTime(market.event_date, market.event_time)}</TableCell>
                    <TableCell>
                      <StatusBadge status={market.status} />
                    </TableCell>
                    <TableCell>{market.odds}</TableCell>
                    <TableCell>{market.bet_count}</TableCell>
                    <TableCell>{formatMoney(market.total_stake)}</TableCell>
                    <TableCell>{formatMoney(market.total_profit)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/markets/${market.id}`}>详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden">
            {markets.map((market) => (
              <Link
                key={market.id}
                href={`/markets/${market.id}`}
                className="-mx-3 block border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-accent/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{market.project}</div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{market.content}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatEventDateTime(market.event_date, market.event_time)}
                    </div>
                  </div>
                  <StatusBadge status={market.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">赔率</div>
                    <div>{market.odds}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">投入</div>
                    <div>{formatMoney(market.total_stake)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">盈亏</div>
                    <div>{formatMoney(market.total_profit)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
