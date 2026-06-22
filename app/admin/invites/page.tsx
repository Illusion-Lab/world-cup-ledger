import { createInviteAction, toggleInviteAction } from "@/app/actions/admin";
import { NumberSliderField } from "@/components/number-slider-field";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { getInviteCodes } from "@/lib/api-data";

const groupRoles = [
  ["member", "成员"],
  ["admin", "账本管理员"],
  ["viewer", "只读"],
];

export default async function AdminInvitesPage() {
  const admin = await requireAdmin();
  const invites = await getInviteCodes(admin.group!.id);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">邀请码</h1>
        <p className="mt-1 text-sm text-muted-foreground">邀请码用于注册本地账号，并自动加入当前账本。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>创建邀请码</CardTitle>
          <CardDescription>可以留空邀请码，系统会自动生成。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createInviteAction} className="grid gap-4 lg:grid-cols-12">
            <div className="grid gap-2 lg:col-span-3">
              <Label htmlFor="code">邀请码</Label>
              <Input id="code" name="code" placeholder="填写邀请码" />
            </div>
            <div className="grid gap-2 lg:col-span-3">
              <Label htmlFor="role">注册角色</Label>
              <Select id="role" name="role" defaultValue="member">
                {groupRoles.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="lg:col-span-2">
              <NumberSliderField
                name="maxUses"
                label="次数"
                defaultValue="1"
                min={1}
                max={50}
                step={1}
                placeholder="填写次数"
              />
            </div>
            <div className="grid gap-2 lg:col-span-4">
              <Label htmlFor="expiresAt">过期时间</Label>
              <Input id="expiresAt" name="expiresAt" type="datetime-local" />
            </div>
            <div className="grid gap-2 lg:col-span-10">
              <Label htmlFor="note">备注</Label>
              <Textarea id="note" name="note" placeholder="填写备注" />
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button type="submit" className="w-full">
                创建
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>邀请码列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邀请码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>使用</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>过期</TableHead>
                <TableHead>备注</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => {
                const exhausted = invite.used_count >= invite.max_uses;
                return (
                  <TableRow key={invite.id}>
                    <TableCell className="font-mono font-medium">{invite.code}</TableCell>
                    <TableCell>
                      {invite.is_active && !exhausted ? (
                        <Badge variant="success">可用</Badge>
                      ) : (
                        <Badge variant="secondary">停用</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {invite.used_count}/{invite.max_uses}
                    </TableCell>
                    <TableCell>{invite.role_on_signup}</TableCell>
                    <TableCell>{invite.expires_at ? new Date(invite.expires_at).toLocaleString("zh-CN") : "-"}</TableCell>
                    <TableCell>{invite.note}</TableCell>
                    <TableCell className="text-right">
                      <form action={toggleInviteAction}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button size="sm" variant="outline" type="submit">
                          {invite.is_active ? "停用" : "启用"}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
