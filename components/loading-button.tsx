"use client";

import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
};

export function LoadingButton({
  children,
  disabled,
  loading,
  loadingText = "处理中",
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {loading ? loadingText : children}
    </Button>
  );
}
