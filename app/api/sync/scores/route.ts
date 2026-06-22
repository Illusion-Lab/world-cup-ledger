import { NextRequest, NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-client";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  return request.headers.get("x-sync-secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch(`${apiBaseUrl()}/internal/sync/scores`, {
    method: "POST",
    headers: {
      "x-sync-secret": request.headers.get("x-sync-secret") || "",
    },
  });
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}
