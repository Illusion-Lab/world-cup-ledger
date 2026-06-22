import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Ticket,
  UserRound,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "@/components/layout/nav-link";
import type { User } from "@/types/domain";

type AppShellUser = User & {
  group?: { id: string; name: string };
};

const mainNav = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/schedule", label: "赛程", icon: CalendarDays },
  { href: "/markets", label: "盘口", icon: ClipboardList },
  { href: "/bets", label: "我的投注", icon: BookOpen },
  { href: "/stats", label: "统计", icon: BarChart3 },
];

function NavItems({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="grid gap-1">
      {mainNav.map((item) => (
        <NavLink key={item.href} href={item.href}>
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
      {isAdmin ? (
        <>
          <NavLink href="/admin/users">
            <Shield className="h-4 w-4" />
            <span>用户管理</span>
          </NavLink>
          <NavLink href="/admin/invites">
            <Ticket className="h-4 w-4" />
            <span>邀请码</span>
          </NavLink>
        </>
      ) : null}
    </nav>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const isAdmin = user.system_role === "super_admin" || user.system_role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b px-5 py-5">
            <div className="text-base font-semibold leading-6">世界杯账本</div>
            <div className="mt-1 truncate text-sm text-muted-foreground">{user.group?.name}</div>
          </div>
          <div className="flex-1 p-3">
            <NavItems isAdmin={isAdmin} />
          </div>
          <div className="border-t p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-secondary">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user.display_name}</div>
                <div className="truncate text-xs text-muted-foreground">@{user.username}</div>
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button variant="outline" className="w-full justify-start" type="submit">
                <LogOut className="h-4 w-4" />
                退出
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="flex h-14 items-center justify-between px-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="打开导航">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <div className="mb-6">
                <div className="text-base font-semibold">世界杯账本</div>
                <div className="mt-1 text-sm text-muted-foreground">{user.group?.name}</div>
              </div>
              <NavItems isAdmin={isAdmin} />
              <form action="/api/auth/logout" method="post" className="mt-5">
                <Button variant="outline" className="w-full justify-start" type="submit">
                  <LogOut className="h-4 w-4" />
                  退出
                </Button>
              </form>
            </SheetContent>
          </Sheet>
          <div className="text-sm font-semibold">世界杯账本</div>
          <ThemeToggle />
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-8 hidden items-center justify-end border-b pb-4 lg:flex">
            <ThemeToggle />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
