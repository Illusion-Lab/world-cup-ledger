import { updateUserAction } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { getAdminUsers } from "@/lib/api-data";
import { formatMoney } from "@/lib/utils";

const systemRoles = [
  ["super_admin", "系统管理员"],
  ["admin", "管理员"],
  ["member", "成员"],
  ["viewer", "只读"],
  ["disabled", "禁用"],
];

const groupRoles = [
  ["owner", "账本所有者"],
  ["admin", "账本管理员"],
  ["member", "成员"],
  ["viewer", "只读"],
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const users = await getAdminUsers(admin.group!.id);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">用户管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理本地账号、系统角色、账本角色和临时密码。</p>
      </div>
      {params.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>禁用用户后无法继续登录。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>系统角色</TableHead>
                  <TableHead>账本角色</TableHead>
                  <TableHead>临时密码</TableHead>
                  <TableHead>投注</TableHead>
                  <TableHead>盈亏</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">@{user.username}</div>
                      {user.disabled_at ? <Badge variant="destructive">已禁用</Badge> : null}
                    </TableCell>
                    <TableCell>
                      <form id={`user-${user.id}`} action={updateUserAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <Input name="displayName" defaultValue={user.display_name} className="min-w-32" />
                      </form>
                    </TableCell>
                    <TableCell>
                      <Select form={`user-${user.id}`} name="systemRole" defaultValue={user.system_role}>
                        {systemRoles.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select form={`user-${user.id}`} name="groupRole" defaultValue={user.group_role}>
                        {groupRoles.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        form={`user-${user.id}`}
                        name="password"
                        type="password"
                        placeholder="填写密码"
                        minLength={8}
                        className="min-w-32"
                      />
                    </TableCell>
                    <TableCell>{user.bet_count}</TableCell>
                    <TableCell>{formatMoney(user.total_profit)}</TableCell>
                    <TableCell className="text-right">
                      <Button form={`user-${user.id}`} type="submit" size="sm">
                        保存
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="xl:hidden">
            {users.map((user) => (
              <form key={user.id} action={updateUserAction} className="-mx-3 border-b px-3 py-4 last:border-b-0">
                <input type="hidden" name="userId" value={user.id} />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">@{user.username}</div>
                    <div className="text-sm text-muted-foreground">
                      投注 {user.bet_count}，盈亏 {formatMoney(user.total_profit)}
                    </div>
                  </div>
                  {user.disabled_at ? <Badge variant="destructive">已禁用</Badge> : null}
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>显示名</Label>
                    <Input name="displayName" defaultValue={user.display_name} />
                  </div>
                  <div className="grid gap-2">
                    <Label>系统角色</Label>
                    <Select name="systemRole" defaultValue={user.system_role}>
                      {systemRoles.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>账本角色</Label>
                    <Select name="groupRole" defaultValue={user.group_role}>
                      {groupRoles.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>临时密码</Label>
                    <Input name="password" type="password" minLength={8} placeholder="填写密码" />
                  </div>
                  <Button type="submit">保存</Button>
                </div>
              </form>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
