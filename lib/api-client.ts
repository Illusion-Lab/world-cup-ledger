import "server-only";

import { cookies } from "next/headers";

const DEFAULT_API_URL = "http://api:4000";

export function apiBaseUrl() {
  return (process.env.API_INTERNAL_URL || DEFAULT_API_URL).replace(/\/$/, "");
}

async function cookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookies = await cookieHeader();
  if (cookies) headers.set("cookie", cookies);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(payload?.error || "请求失败", response.status);
  }
  return payload as T;
}

export async function apiAction<T>(path: string, method: string, body?: Record<string, unknown>) {
  return apiFetch<T>(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}
