import { NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-client";
import { getRequestOrigin } from "@/lib/request-url";

export async function POST(request: Request) {
  const apiResponse = await fetch(`${apiBaseUrl()}/auth/logout`, {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });
  const response = NextResponse.redirect(new URL("/login", getRequestOrigin(request)), 303);
  const setCookie = apiResponse.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}
