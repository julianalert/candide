import { NextResponse } from "next/server";
import { getParticipant, unauthorised } from "@/lib/play";
import { buildPlayState } from "@/lib/play-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getParticipant();
  if (!ctx) return unauthorised();
  const state = await buildPlayState(ctx);
  return NextResponse.json(state, { headers: { "cache-control": "no-store" } });
}
