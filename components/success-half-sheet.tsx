"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

type SuccessHalfSheetProps = {
  open: boolean;
  title?: string;
  description?: string;
  children?: ReactNode;
};

export function SuccessHalfSheet({
  open,
  title = "已完成",
  description = "操作已保存",
  children,
}: SuccessHalfSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/35 backdrop-blur-[2px]">
      <div className="success-sheet-panel flex h-[52vh] min-h-80 w-full flex-col items-center justify-center rounded-t-2xl border border-border bg-background px-6 text-center shadow-modal">
        <div className="success-check-badge mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--geist-green-700)] text-white shadow-[0_18px_60px_rgba(40,169,72,0.28)]">
          <Check className="success-check-icon h-14 w-14" strokeWidth={3.5} />
        </div>
        <div className="text-2xl font-semibold tracking-normal">{title}</div>
        <div className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</div>
        {children ? <div className="mt-6 w-full max-w-sm">{children}</div> : null}
      </div>
    </div>
  );
}
