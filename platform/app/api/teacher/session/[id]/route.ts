import { NextResponse, type NextRequest } from "next/server";
import { sessionIsOver } from "@/lib/caps";
import { removeSessionImages } from "@/lib/storage";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { SessionRow } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** Join count for the launch page. Runs with the teacher's session, so RLS applies. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const { data: session } = await supabase.from("sessions").select("id, started_at, ended_at").eq("id", id).maybeSingle<Pick<SessionRow, "id" | "started_at" | "ended_at">>();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { count } = await supabase.from("participants").select("id", { count: "exact", head: true }).eq("session_id", id);
  return NextResponse.json({ count: count ?? 0, ended: sessionIsOver(session) }, { headers: { "cache-control": "no-store" } });
}

/** School admins: delete a session and everything under it. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const { data, error } = await supabase.from("sessions").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Not found or not allowed" }, { status: 404 });
  const removed = await removeSessionImages(createServiceSupabase(), id);
  return NextResponse.json({ deleted: id, imagesRemoved: removed });
}

/** End a session. */
export async function PATCH(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { data, error } = await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", id).is("ended_at", null).select("id, ended_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ended: data?.[0]?.ended_at ?? null });
}
