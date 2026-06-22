import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatEventDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
) {
  const dateText = date?.trim();
  const timeText = time?.trim();
  if (!dateText && !timeText) return "-";
  return [dateText, timeText].filter(Boolean).join(" ");
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return 0;
}
