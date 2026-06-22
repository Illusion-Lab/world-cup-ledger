"use client";

import { FormEvent, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createMarketDialogAction,
  deleteBetDialogAction,
  saveBetDialogAction,
  updateMarketDialogAction,
  type DialogActionResult,
} from "@/app/actions/markets";
import { LoadingButton } from "@/components/loading-button";
import { NumberSliderField } from "@/components/number-slider-field";
import { SuccessHalfSheet } from "@/components/success-half-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categoryOptions, statusOptions, type Bet, type Market } from "@/types/domain";

type DialogAction = (formData: FormData) => Promise<DialogActionResult>;

function useDialogSubmission({
  action,
  closeDialog,
}: {
  action: DialogAction;
  closeDialog: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    setError("");
    setPending(true);

    startTransition(() => {
      void action(formData)
        .then((result) => {
          if (!result.ok) {
            setError(result.error);
            setPending(false);
            return;
          }

          setSuccessOpen(true);
          window.setTimeout(() => {
            setSuccessOpen(false);
            setPending(false);
            if (result.redirectTo) {
              router.push(result.redirectTo);
            } else {
              closeDialog();
              router.refresh();
            }
          }, 1150);
        })
        .catch(() => {
          setError("操作失败");
          setPending(false);
        });
    });
  }

  return { error, pending, submit, successOpen };
}

function ActionError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

export function CreateMarketDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const submission = useDialogSubmission({
    action: createMarketDialogAction,
    closeDialog: () => setOpen(false),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !submission.pending && setOpen(nextOpen)}>
        <DialogTrigger asChild>
          <Button size="sm" className="h-9 shrink-0 px-3">
            <Plus className="h-4 w-4" />
            新建
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增盘口</DialogTitle>
            <DialogDescription>创建共享盘口后，成员可以在详情页各自下注。</DialogDescription>
          </DialogHeader>
          <form onSubmit={submission.submit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="project">项目</Label>
              <Input id="project" name="project" placeholder="填写项目" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">投注内容</Label>
              <Input id="content" name="content" placeholder="填写内容" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">分类</Label>
              <Select id="category" name="category" defaultValue="投注">
                {categoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eventDate">日期</Label>
              <Input id="eventDate" name="eventDate" type="date" className="date-input" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eventTime">时间</Label>
              <Input id="eventTime" name="eventTime" placeholder="填写时间" />
            </div>
            <NumberSliderField
              name="odds"
              label="赔率"
              defaultValue="2"
              min={1}
              max={6}
              step={0.001}
              placeholder="填写数值"
              required
            />
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="note">备注</Label>
              <Textarea id="note" name="note" placeholder="填写备注" />
            </div>
            <div className="sm:col-span-2">
              <ActionError message={submission.error} />
            </div>
            <LoadingButton
              type="submit"
              loading={submission.pending}
              loadingText="创建中"
              className="w-full sm:col-span-2"
            >
              创建盘口
            </LoadingButton>
          </form>
        </DialogContent>
      </Dialog>
      <SuccessHalfSheet
        open={submission.successOpen}
        title="盘口已创建"
        description="正在进入盘口详情"
      />
    </>
  );
}

export function EditMarketDialog({ market }: { market: Market }) {
  const [open, setOpen] = useState(false);
  const submission = useDialogSubmission({
    action: updateMarketDialogAction,
    closeDialog: () => setOpen(false),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !submission.pending && setOpen(nextOpen)}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
            编辑盘口
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑盘口</DialogTitle>
            <DialogDescription>保存后会重新计算未手动覆盖产出的投注。</DialogDescription>
          </DialogHeader>
          <form onSubmit={submission.submit} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="marketId" value={market.id} />
            <div className="grid gap-2">
              <Label htmlFor="editProject">项目</Label>
              <Input id="editProject" name="project" defaultValue={market.project} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editContent">投注内容</Label>
              <Input id="editContent" name="content" defaultValue={market.content} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editCategory">分类</Label>
              <Select id="editCategory" name="category" defaultValue={market.category}>
                {categoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editStatus">状态</Label>
              <Select id="editStatus" name="status" defaultValue={market.status}>
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEventDate">日期</Label>
              <Input
                id="editEventDate"
                name="eventDate"
                type="date"
                defaultValue={market.event_date}
                className="date-input"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editEventTime">时间</Label>
              <Input id="editEventTime" name="eventTime" defaultValue={market.event_time} />
            </div>
            <div className="sm:col-span-2">
              <NumberSliderField
                name="odds"
                label="赔率"
                defaultValue={String(market.odds)}
                min={1}
                max={6}
                step={0.001}
                placeholder="填写数值"
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="editNote">盘口备注</Label>
              <Textarea id="editNote" name="note" defaultValue={market.note ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <ActionError message={submission.error} />
            </div>
            <LoadingButton
              type="submit"
              loading={submission.pending}
              loadingText="保存中"
              className="w-full sm:col-span-2"
            >
              保存盘口
            </LoadingButton>
          </form>
        </DialogContent>
      </Dialog>
      <SuccessHalfSheet
        open={submission.successOpen}
        title="盘口已保存"
        description="最新内容已经写入账本"
      />
    </>
  );
}

export function BetDialog({ marketId, myBet }: { marketId: string; myBet: Bet | null }) {
  const [open, setOpen] = useState(false);
  const saveSubmission = useDialogSubmission({
    action: saveBetDialogAction,
    closeDialog: () => setOpen(false),
  });
  const deleteSubmission = useDialogSubmission({
    action: deleteBetDialogAction,
    closeDialog: () => setOpen(false),
  });
  const isBusy = saveSubmission.pending || deleteSubmission.pending;

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !isBusy && setOpen(nextOpen)}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Wallet className="h-4 w-4" />
            {myBet ? "编辑投注" : "下注"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{myBet ? "编辑我的投注" : "记录我的投注"}</DialogTitle>
            <DialogDescription>投入会参与个人盈亏统计，同一盘口每人一条投注。</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSubmission.submit} className="grid gap-4">
            <input type="hidden" name="marketId" value={marketId} />
            <NumberSliderField
              name="stake"
              label="投入"
              defaultValue={String(myBet?.stake ?? "200")}
              min={0}
              max={10000}
              step={10}
              placeholder="填写投入"
              required
            />
            <div className="grid gap-2">
              <Label htmlFor="payout">产出</Label>
              <Input
                id="payout"
                name="payout"
                type="number"
                step="0.01"
                min="0"
                defaultValue={myBet?.manual_payout ? myBet.payout ?? "" : ""}
                placeholder="填写产出"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="betNote">个人备注</Label>
              <Textarea id="betNote" name="note" defaultValue={myBet?.note ?? ""} placeholder="填写备注" />
            </div>
            <ActionError message={saveSubmission.error} />
            <LoadingButton
              type="submit"
              loading={saveSubmission.pending}
              loadingText="保存中"
              disabled={deleteSubmission.pending}
              className="w-full"
            >
              保存投注
            </LoadingButton>
          </form>
          {myBet ? (
            <form onSubmit={deleteSubmission.submit} className="grid gap-3">
              <input type="hidden" name="marketId" value={marketId} />
              <ActionError message={deleteSubmission.error} />
              <LoadingButton
                type="submit"
                variant="outline"
                loading={deleteSubmission.pending}
                loadingText="删除中"
                disabled={saveSubmission.pending}
                className="w-full"
              >
                <Trash2 className="h-4 w-4" />
                删除我的投注
              </LoadingButton>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
      <SuccessHalfSheet
        open={saveSubmission.successOpen}
        title="投注已保存"
        description="你的投注和盈亏统计已更新"
      />
      <SuccessHalfSheet
        open={deleteSubmission.successOpen}
        title="投注已删除"
        description="你的投注记录已从该盘口移除"
      />
    </>
  );
}
