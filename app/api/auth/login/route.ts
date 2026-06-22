import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-client";
import { getRequestOrigin } from "@/lib/request-url";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getRequestOrigin(request)), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  const apiResponse = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": new URL(getRequestOrigin(request)).protocol.replace(":", ""),
    },
    body: JSON.stringify({ username, password }),
  });
  if (!apiResponse.ok) {
    const payload = await apiResponse.json().catch(() => ({ error: "登录失败" }));
    return redirectTo(request, `/login?error=${encodeURIComponent(payload.error || "登录失败")}`);
  }

  const response = redirectTo(request, "/dashboard");
  const setCookie = apiResponse.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}
