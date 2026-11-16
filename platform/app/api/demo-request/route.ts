import { NextResponse, type NextRequest } from "next/server";
import { allowedOrigin, confirmationVariables, DemoRequestSchema, demoEmailIds, demoNotifyEmails, teamAlertVariables } from "@/lib/demo";
import { loopsConfigured, sendTransactionalEmail } from "@/lib/loops";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Book a demo" from candideai.com: save the request, email the team, confirm to the person.
// The request counts as received if either the save or the emails worked.

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = allowedOrigin(request.headers.get("origin"));
  return origin
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
    : { vary: "origin" };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Send the form as JSON." }, { status: 400, headers });
  // Honeypot: real people never see this field.
  if (body._gotcha) return NextResponse.json({ ok: true }, { headers });

  const parsed = DemoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400, headers });
  }
  const demo = parsed.data;

  const db = createServiceSupabase();
  let savedId: string | null = null;
  try {
    const { data, error } = await db
      .from("demo_requests")
      .insert({
        school: demo.school,
        city_country: demo.city_country,
        contact_name: demo.contact_name,
        role: demo.role,
        email: demo.email,
        phone: demo.phone,
        ages: demo.ages,
        club_groups: demo.club_groups || null,
        devices: demo.devices || null,
        notes: demo.notes || null,
      })
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;
    savedId = data.id;
  } catch (error) {
    console.error("demo-request: could not save", error);
  }

  const ids = demoEmailIds();
  const team = demoNotifyEmails();
  let teamAlerted = false;
  let emailError: string | null = null;
  if (!loopsConfigured() || !ids.teamAlert || !ids.confirmation || team.length === 0) {
    emailError = "Loops is not configured (LOOPS_API_KEY, LOOPS_DEMO_ALERT_ID, LOOPS_DEMO_CONFIRM_ID, DEMO_NOTIFY_EMAILS)";
    console.warn(`demo-request: ${emailError}`);
  } else {
    const alertVariables = teamAlertVariables(demo);
    const results = await Promise.allSettled([
      ...team.map((email) => sendTransactionalEmail({ transactionalId: ids.teamAlert, email, dataVariables: alertVariables })),
      sendTransactionalEmail({ transactionalId: ids.confirmation, email: demo.email, dataVariables: confirmationVariables(demo) }),
    ]);
    // The team alert is what matters; a bad requester address alone doesn't lose the request.
    teamAlerted = results.slice(0, team.length).some((result) => result.status === "fulfilled");
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length) {
      emailError = failures.map((failure) => String(failure.reason?.message ?? failure.reason)).join(" | ").slice(0, 1000);
      console.error("demo-request: email failed", emailError);
    }
  }

  // Neither saved nor anyone told: the request would be lost.
  if (!savedId && !teamAlerted) {
    return NextResponse.json({ error: "We couldn't send your request. Please try again, or write to hello@candideai.com." }, { status: 502, headers });
  }

  if (savedId) {
    const { error } = await db.from("demo_requests").update({ emails_sent: emailError === null, email_error: emailError }).eq("id", savedId);
    if (error) console.error("demo-request: could not record email status", error);
  }

  return NextResponse.json({ ok: true }, { headers });
}
