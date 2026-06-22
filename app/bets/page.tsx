import { BetsList } from "@/components/bets-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getMyBets } from "@/lib/api-data";

export default async function BetsPage() {
  const user = await requireUser();
  const bets = await getMyBets(user.group!.id, user.id);

  return (
    <div className="grid max-w-full gap-3 overflow-x-hidden sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">我的投注</h1>
        <p className="mt-1 hidden text-sm text-muted-foreground sm:block">只展示当前用户在共享盘口下的个人账目。</p>
      </div>

      <Card className="max-w-full overflow-hidden">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle>投注明细</CardTitle>
          <CardDescription className="hidden sm:block">进入盘口详情可以修改投入、产出覆盖和个人备注。</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <BetsList bets={bets} />
        </CardContent>
      </Card>
    </div>
  );
}
