"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, apiAction } from "@/lib/api-client";
import { formString, messagePath } from "@/lib/form";

type IdResponse = { id: string };
type SyncResponse = { syncedEvents: number; settledMarkets: number };
type CountResponse = { count: number };
export type DialogActionResult =
  | { ok: true; id?: string; redirectTo?: string; count?: number }
  | { ok: false; error: string };

function formPayload(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formString(formData, key)]));
}

function actionErrorPath(path: string, error: unknown, fallback = "操作失败") {
  return messagePath(path, actionErrorMessage(error, fallback));
}

function actionErrorMessage(error: unknown, fallback = "操作失败") {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

async function createMarket(formData: FormData) {
  return apiAction<IdResponse>("/markets", "POST", {
    ...formPayload(formData, [
      "project",
      "content",
      "category",
      "eventDate",
      "eventTime",
      "odds",
      "note",
    ]),
  });
}

async function createMarketFromEvent(formData: FormData) {
  return apiAction<IdResponse>("/markets/from-event", "POST", {
    ...formPayload(formData, [
      "externalEventId",
      "selectionHomeAway",
      "handicap",
      "odds",
      "note",
    ]),
  });
}

async function updateMarket(formData: FormData) {
  const id = formString(formData, "marketId");
  await apiAction(`/markets/${id}`, "PUT", {
    ...formPayload(formData, [
      "project",
      "content",
      "category",
      "eventDate",
      "eventTime",
      "odds",
      "status",
      "note",
    ]),
  });
  return id;
}

async function saveBet(formData: FormData) {
  const marketId = formString(formData, "marketId");
  await apiAction(`/markets/${marketId}/bet`, "POST", {
    ...formPayload(formData, ["stake", "payout", "note"]),
  });
  return marketId;
}

async function deleteBet(formData: FormData) {
  const marketId = formString(formData, "marketId");
  await apiAction(`/markets/${marketId}/bet`, "DELETE");
  return marketId;
}

async function updateMarketSettlement(formData: FormData) {
  const marketId = formString(formData, "marketId");
  await apiAction(`/markets/${marketId}/settlement`, "POST", {
    isSettled: formString(formData, "isSettled") === "true",
  });
  return marketId;
}

async function updateMarketDaySettlement(formData: FormData) {
  return apiAction<CountResponse>("/markets/settlement/day", "POST", {
    eventDate: formString(formData, "eventDate"),
    isSettled: formString(formData, "isSettled") === "true",
  });
}

export async function createMarketAction(formData: FormData) {
  let result: IdResponse;
  try {
    result = await createMarket(formData);
  } catch (error) {
    redirect(actionErrorPath("/markets", error));
  }

  revalidatePath("/markets");
  redirect(`/markets/${result.id}`);
}

export async function syncWorldCupScheduleAction() {
  let result: SyncResponse;
  try {
    result = await apiAction<SyncResponse>("/schedule/sync", "POST");
  } catch (error) {
    redirect(actionErrorPath("/schedule", error, "赛程同步失败"));
  }
  revalidatePath("/schedule");
  revalidatePath("/markets");
  revalidatePath("/dashboard");
  revalidatePath("/stats");
  redirect(
    `/schedule?synced=${encodeURIComponent(
      `已同步 ${result.syncedEvents} 场比赛，自动判定 ${result.settledMarkets} 个盘口`,
    )}`,
  );
}

export async function createMarketFromEventAction(formData: FormData) {
  let result: IdResponse;
  try {
    result = await createMarketFromEvent(formData);
  } catch (error) {
    redirect(actionErrorPath("/schedule", error));
  }

  revalidatePath("/schedule");
  revalidatePath("/markets");
  revalidatePath("/dashboard");
  redirect(`/markets/${result.id}`);
}

export async function updateMarketAction(formData: FormData) {
  const id = formString(formData, "marketId");
  try {
    await updateMarket(formData);
  } catch (error) {
    redirect(actionErrorPath(`/markets/${id}`, error));
  }

  revalidatePath(`/markets/${id}`);
  revalidatePath("/markets");
  revalidatePath("/dashboard");
  revalidatePath("/stats");
  redirect(`/markets/${id}`);
}

export async function archiveMarketAction(formData: FormData) {
  const id = formString(formData, "marketId");
  try {
    await apiAction(`/markets/${id}/archive`, "POST");
  } catch (error) {
    redirect(actionErrorPath(`/markets/${id}`, error));
  }
  revalidatePath("/markets");
  redirect("/markets");
}

export async function saveBetAction(formData: FormData) {
  const marketId = formString(formData, "marketId");
  try {
    await saveBet(formData);
  } catch (error) {
    redirect(actionErrorPath(`/markets/${marketId}`, error));
  }
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/bets");
  revalidatePath("/stats");
  redirect(`/markets/${marketId}`);
}

export async function deleteBetAction(formData: FormData) {
  const marketId = formString(formData, "marketId");
  try {
    await deleteBet(formData);
  } catch (error) {
    redirect(actionErrorPath(`/markets/${marketId}`, error));
  }
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/bets");
  revalidatePath("/stats");
  redirect(`/markets/${marketId}`);
}

export async function createMarketDialogAction(formData: FormData): Promise<DialogActionResult> {
  try {
    const result = await createMarket(formData);
    revalidatePath("/markets");
    revalidatePath("/dashboard");
    return { ok: true, id: result.id, redirectTo: `/markets/${result.id}` };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function createMarketFromEventDialogAction(
  formData: FormData,
): Promise<DialogActionResult> {
  try {
    const result = await createMarketFromEvent(formData);
    revalidatePath("/schedule");
    revalidatePath("/markets");
    revalidatePath("/dashboard");
    return { ok: true, id: result.id, redirectTo: `/markets/${result.id}` };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function updateMarketDialogAction(formData: FormData): Promise<DialogActionResult> {
  const id = formString(formData, "marketId");
  try {
    await updateMarket(formData);
    revalidatePath(`/markets/${id}`);
    revalidatePath("/markets");
    revalidatePath("/dashboard");
    revalidatePath("/stats");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function saveBetDialogAction(formData: FormData): Promise<DialogActionResult> {
  const marketId = formString(formData, "marketId");
  try {
    await saveBet(formData);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/bets");
    revalidatePath("/stats");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function deleteBetDialogAction(formData: FormData): Promise<DialogActionResult> {
  const marketId = formString(formData, "marketId");
  try {
    await deleteBet(formData);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/bets");
    revalidatePath("/stats");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function updateMarketSettlementDialogAction(
  formData: FormData,
): Promise<DialogActionResult> {
  const marketId = formString(formData, "marketId");
  try {
    await updateMarketSettlement(formData);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    revalidatePath("/dashboard");
    revalidatePath("/bets");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function updateMarketDaySettlementDialogAction(
  formData: FormData,
): Promise<DialogActionResult> {
  try {
    const result = await updateMarketDaySettlement(formData);
    revalidatePath("/markets");
    revalidatePath("/dashboard");
    revalidatePath("/bets");
    return { ok: true, count: result.count };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error) };
  }
}
