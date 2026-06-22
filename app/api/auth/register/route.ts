import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-client";
import { getRequestOrigin } from "@/lib/request-url";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getRequestOrigin(request)), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const invite = String(formData.get("invite") || "").trim().toUpperCase();
  const username = String(formData.get("username") || "");
  const displayName = String(formData.get("displayName") || "").trim() || username;
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const apiResponse = await fetch(`${apiBaseUrl()}/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": new URL(getRequestOrigin(request)).protocol.replace(":", ""),
    },
    body: JSON.stringify({ invite, username, displayName, password, confirmPassword }),
  });
  if (!apiResponse.ok) {
    const payload = await apiResponse.json().catch(() => ({ error: "注册失败" }));
    return redirectTo(request, `/register?error=${encodeURIComponent(payload.error || "注册失败")}`);
  }

  const response = redirectTo(request, "/dashboard");
  const setCookie = apiResponse.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}
