import type { NextRequest } from "next/server";

import { authRuntime } from "@/lib/auth";
import { authConfigured, authUnavailable } from "@/lib/auth-config";

export async function GET(request: NextRequest): Promise<Response> {
  if (!authConfigured()) return authUnavailable();
  return authRuntime().handlers.GET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!authConfigured()) return authUnavailable();
  return authRuntime().handlers.POST(request);
}
