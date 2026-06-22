import Link from "next/link";
import { Archive } from "lucide-react";
import { notFound } from "next/navigation";

import { archiveMarketAction } from "@/app/actions/markets";
import { BetDialog, EditMarketDialog } from "@/components/market-action-dialogs";
import {
  MarketSettlementAction,
  SettlementBadge,
} from "@/components/market-settlement-actions";
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
import { canEditMarket, requireUser } from "@/lib/auth";
import { getMarketDetail, getMarkets, getMyBets } from "@/lib/api-data";
import { formatEventDateTime, formatMoney } from "@/lib/utils";
import { statusLabels, type Bet, type Market } from "@/types/domain";

function findNextUnbetMarket(markets: Market[], currentMarketId: string, myBets: Bet[]) {
  const currentIndex = markets.findIndex((market) => market.id === currentMarketId);
  const betMarketIds = new Set(myBets.map((bet) => bet.market_id));
  const orderedMarkets =
    currentIndex >= 0
      ? [...markets.slice(currentIndex + 1), ...markets.slice(0, currentIndex)]
      : markets;

  return (
    orderedMarkets.find((market) => market.id !== currentMarketId && !betMarketIds.has(market.id)) ??
    null
  );
}

export default async function MarketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const [detail, markets, myBets] = await Promise.all([
    getMarketDetail(user.group!.id, id, user.id),
    getMarkets(user.group!.id),
    getMyBets(user.group!.id, user.id),
  ]);
  const market = detail.market;
  if (!market) notFound();

  const nextUnbetMarket = findNextUnbetMarket(markets, market.id, myBets);
  const editable = canEditMarket(user, market.created_by_user_id);
  const participantStake = detail.bets.reduce((sum, bet) => sum + Number(bet.stake), 0);
  const participantProfit = detail.bets.reduce(
    (sum, bet) => sum + Number(bet.profit ?? 0),
    0,
  );

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2">
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link href="/markets">返回盘口</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">{market.project}</h1>
            <StatusBadge status={market.status} />
            <SettlementBadge isSettled={market.is_settled} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {market.content}，赔率 {market.odds}，由 {market.created_by_name} 创建
          </p>
        </div>
        {editable ? (
          <form action={archiveMarketAction}>
            <input type="hidden" name="marketId" value={market.id} />
            <Button variant="outline" type="submit">
              <Archive className="h-4 w-4" />
              归档
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>参与人数</CardDescription>
            <CardTitle>{detail.bets.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>总投入</CardDescription>
            <CardTitle>{formatMoney(participantStake)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardDescription>总盈亏</CardDescription>
            <CardTitle className={participantProfit >= 0 ? "text-[var(--geist-green-700)]" : "text-destructive"}>
              {formatMoney(participantProfit)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {detail.externalEvent ? (
        <Card>
          <CardHeader>
            <CardTitle>绑定比赛</CardTitle>
            <CardDescription>
              {market.auto_settle
                ? "该盘口会按绑定比赛的完赛比分自动结算。"
                : "该盘口已绑定比赛，但未启用自动结算。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">比赛</div>
                <div className="font-medium">
                  {detail.externalEvent.home_team_name} vs {detail.externalEvent.away_team_name}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">时间</div>
                <div>
                  {detail.externalEvent.event_date} {detail.externalEvent.event_time}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">比分</div>
                <div>
                  {detail.externalEvent.home_score === null || detail.externalEvent.away_score === null
                    ? "未完赛"
                    : `${detail.externalEvent.home_score} - ${detail.externalEvent.away_score}`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">自动盘口</div>
                <div>
                  {market.selection_team_name
                    ? market.content
                    : "未配置"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>盘口信息</CardTitle>
              <CardDescription>结算状态变化后，会自动重算未手动覆盖产出的投注。</CardDescription>
            </div>
            {editable ? (
              <div className="flex flex-wrap gap-2">
                <MarketSettlementAction
                  marketId={market.id}
                  isSettled={market.is_settled}
                  canEdit={editable}
                  compact
                />
                <EditMarketDialog market={market} />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4">
            {query.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {query.error}
              </div>
            ) : null}
            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-muted-foreground">项目</div>
                <div className="mt-1 font-medium">{market.project}</div>
              </div>
              <div>
                <div className="text-muted-foreground">投注内容</div>
                <div className="mt-1 font-medium">{market.content}</div>
              </div>
              <div>
                <div className="text-muted-foreground">分类</div>
                <div className="mt-1 font-medium">{market.category}</div>
              </div>
              <div>
                <div className="text-muted-foreground">状态</div>
                <div className="mt-1 font-medium">{statusLabels[market.status]}</div>
              </div>
              <div>
                <div className="text-muted-foreground">账务结算</div>
                <div className="mt-1">
                  <SettlementBadge isSettled={market.is_settled} />
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">比赛时间</div>
                <div className="mt-1 font-medium">
                  {formatEventDateTime(market.event_date, market.event_time)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">赔率</div>
                <div className="mt-1 font-medium">{market.odds}</div>
              </div>
              <div>
                <div className="text-muted-foreground">创建人</div>
                <div className="mt-1 font-medium">{market.created_by_name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">备注</div>
                <div className="mt-1 font-medium">{market.note || "-"}</div>
              </div>
            </div>
            {!editable ? (
              <p className="text-sm text-muted-foreground">
                只有创建人或管理员可以修改共享盘口。
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between xl:flex-col xl:items-stretch">
            <div>
              <CardTitle>我的投注</CardTitle>
              <CardDescription>每个用户在同一盘口下维护自己的投入和备注。</CardDescription>
            </div>
            <BetDialog
              marketId={market.id}
              myBet={detail.myBet}
              nextUnbetMarket={nextUnbetMarket}
            />
          </CardHeader>
          <CardContent>
            {detail.myBet ? (
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-muted-foreground">投入</div>
                    <div className="font-medium">{formatMoney(detail.myBet.stake)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">产出</div>
                    <div className="font-medium">{formatMoney(detail.myBet.payout)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">盈亏</div>
                    <div className="font-medium">{formatMoney(detail.myBet.profit)}</div>
                  </div>
                </div>
                {detail.myBet.note ? (
                  <p className="rounded-md bg-secondary px-3 py-2 text-muted-foreground">
                    {detail.myBet.note}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                还没有记录投注
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>参与投注</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>投入</TableHead>
                  <TableHead>产出</TableHead>
                  <TableHead>盈亏</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.bets.map((bet) => (
                  <TableRow key={bet.id}>
                    <TableCell>{bet.display_name}</TableCell>
                    <TableCell>{formatMoney(bet.stake)}</TableCell>
                    <TableCell>{formatMoney(bet.payout)}</TableCell>
                    <TableCell>{formatMoney(bet.profit)}</TableCell>
                    <TableCell>{bet.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden">
            {detail.bets.map((bet) => (
              <div key={bet.id} className="-mx-3 border-b px-3 py-3 last:border-b-0">
                <div className="font-medium">{bet.display_name}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">投入</div>
                    <div>{formatMoney(bet.stake)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">产出</div>
                    <div>{formatMoney(bet.payout)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">盈亏</div>
                    <div>{formatMoney(bet.profit)}</div>
                  </div>
                </div>
                {bet.note ? <p className="mt-3 text-sm text-muted-foreground">{bet.note}</p> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
