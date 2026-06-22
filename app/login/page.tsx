import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between">
        <div>
          <div className="text-base font-semibold">世界杯账本</div>
          <div className="mt-1 text-sm text-muted-foreground">多人共享盘口和投注记账</div>
        </div>
        <ThemeToggle />
      </div>
      <div className="mx-auto mt-20 w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>登录世界杯账本</CardTitle>
          <CardDescription>使用本地用户名和密码进入账本。</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {params.error}
            </div>
          ) : null}
          <form action="/api/auth/login" method="post" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" name="username" autoComplete="username" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            有邀请码？{" "}
            <Link className="font-medium text-primary hover:underline" href="/register">
              注册账号
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
