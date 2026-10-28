import type { NextRequest } from "next/server";

import { authConfigured, authRuntime, authUnavailable } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<Response> {
  if (!authConfigured()) return authUnavailable();
  return authRuntime().handlers.GET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!authConfigured()) return authUnavailable();
  return authRuntime().handlers.POST(request);
}
