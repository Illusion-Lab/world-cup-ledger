import "server-only";

import { apiFetch } from "@/lib/api-client";

export function getDashboardSummary(_groupId: string, _userId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getDashboardSummary>>>("/dashboard");
}

export function getMarkets(_groupId: string, search = "", status = "") {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getMarkets>>>(
    `/markets${params.size ? `?${params.toString()}` : ""}`,
  );
}

export function getMarketDetail(_groupId: string, marketId: string, _userId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getMarketDetail>>>(
    `/markets/${marketId}`,
  );
}

export function getMyBets(_groupId: string, _userId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getMyBets>>>("/bets");
}

export function getStats(_groupId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getStats>>>("/stats");
}

export function getAdminUsers(_groupId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getAdminUsers>>>("/admin/users");
}

export function getInviteCodes(_groupId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getInviteCodes>>>("/admin/invites");
}

export function getExternalEventsForSchedule(_groupId: string) {
  return apiFetch<Awaited<ReturnType<typeof import("@/lib/data").getExternalEventsForSchedule>>>(
    "/schedule",
  );
}
