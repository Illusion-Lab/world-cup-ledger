import "server-only";

import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import type { Group, GroupMember, User } from "@/types/domain";

type CurrentUser = User & {
  group?: Group;
  membership?: GroupMember;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const result = await apiFetch<{ user: CurrentUser | null }>("/auth/me");
    return result.user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.group) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!canManageSystem(user)) redirect("/dashboard");
  return user;
}

export function canManageSystem(user: CurrentUser) {
  return user.system_role === "super_admin" || user.system_role === "admin";
}

export function canManageGroup(user: CurrentUser) {
  return (
    canManageSystem(user) ||
    user.membership?.role === "owner" ||
    user.membership?.role === "admin"
  );
}

export function canEditMarket(user: CurrentUser, createdByUserId: string) {
  return canManageGroup(user) || user.id === createdByUserId;
}
