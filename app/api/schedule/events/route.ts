import { NextRequest, NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const response = await fetch(`${apiBaseUrl()}/schedule`, {
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
    cache: "no-store",
  });
  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
