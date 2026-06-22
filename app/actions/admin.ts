"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, apiAction } from "@/lib/api-client";
import { formString, messagePath } from "@/lib/form";

function actionErrorPath(path: string, error: unknown, fallback = "操作失败") {
  const message = error instanceof ApiError || error instanceof Error ? error.message : fallback;
  return messagePath(path, message);
}

export async function createInviteAction(formData: FormData) {
  try {
    await apiAction("/admin/invites", "POST", {
      role: formString(formData, "role"),
      maxUses: formString(formData, "maxUses"),
      expiresAt: formString(formData, "expiresAt"),
      note: formString(formData, "note"),
      code: formString(formData, "code"),
    });
  } catch (error) {
    redirect(actionErrorPath("/admin/invites", error));
  }
  revalidatePath("/admin/invites");
  redirect("/admin/invites");
}

export async function toggleInviteAction(formData: FormData) {
  const inviteId = formString(formData, "inviteId");
  try {
    await apiAction(`/admin/invites/${inviteId}/toggle`, "POST");
  } catch (error) {
    redirect(actionErrorPath("/admin/invites", error));
  }
  revalidatePath("/admin/invites");
  redirect("/admin/invites");
}

export async function updateUserAction(formData: FormData) {
  const userId = formString(formData, "userId");
  try {
    await apiAction(`/admin/users/${userId}`, "PUT", {
      displayName: formString(formData, "displayName"),
      systemRole: formString(formData, "systemRole"),
      groupRole: formString(formData, "groupRole"),
      password: formString(formData, "password"),
    });
  } catch (error) {
    redirect(actionErrorPath("/admin/users", error));
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
