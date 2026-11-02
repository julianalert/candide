import Link from "next/link";
import { notFound } from "next/navigation";
import { sessionIsOver } from "@/lib/caps";
import { joinUrlForDisplay } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow } from "@/lib/types";

type SessionSummary = { id: string; started_at: string; ended_at: string | null; public_id: string; title: string | null };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher();
  const { data: klass } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassRow>();
  if (!klass) notFound();

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, started_at, ended_at, public_id, title:mission_snapshot->>title")
    .eq("class_id", id)
    .order("started_at", { ascending: false });
  const sessions = (sessionRows ?? []) as unknown as SessionSummary[];
  const live = sessions.find((s) => !sessionIsOver(s));

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">
            <Link href="/teacher">Classes</Link> · Year {klass.year_group}
          </p>
          <h1>{klass.name}</h1>
        </div>
        <div className="actions">
          {live ? (
            <Link className="btn btn-primary" href={`/teacher/session/${live.id}`}>
              Open the live session
            </Link>
          ) : (
            <Link className="btn btn-primary" href={`/teacher/class/${klass.id}/missions`}>
              Start a mission
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <div className="card card-pad stack" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
          <span className="section-label">Class code</span>
          <span className="mono" style={{ fontSize: "clamp(48px, 7vw, 84px)", letterSpacing: "0.16em", color: "var(--color-petrol)", lineHeight: 1 }}>
            {klass.code}
          </span>
          <span className="meta">
            Kids go to <b>{joinUrlForDisplay()}</b> and type this code. It never changes.
          </span>
        </div>

        <section className="section">
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Sessions</h2>
              <span className="meta">
                {sessions.length} so far
              </span>
            </div>
            {sessions.length === 0 ? (
              <p className="meta card-pad">No sessions yet. Pick a mission to run your first one.</p>
            ) : (
              <div className="list">
                {sessions.map((session) => {
                  const over = sessionIsOver(session);
                  return (
                    <div key={session.id} className="item-row">
                      <div className="grow">
                        <b>{session.title ?? "Mission"}</b>
                        <span className="meta">{formatDateTime(session.started_at)}</span>
                      </div>
                      {over ? <span className="chip">Ended</span> : <span className="chip chip-live">Live</span>}
                      <Link className="btn" href={over ? `/teacher/session/${session.id}/gallery` : `/teacher/session/${session.id}`}>
                        {over ? "Gallery" : "Launch page"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
