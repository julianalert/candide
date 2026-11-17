import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { endSession } from "@/app/teacher/actions";
import { ConfirmForm } from "@/components/confirm-form";
import { JoinCount } from "@/components/join-count";
import { sessionIsOver } from "@/lib/caps";
import { joinUrlForDisplay } from "@/lib/env";
import { formatDateTime, weekLabel } from "@/lib/format";
import { MissionSchema, isTrack, kidSteps, snapshotInfo } from "@/lib/missions";
import { requireTeacher } from "@/lib/teacher";
import type { SessionRow } from "@/lib/types";

type SessionWithClass = SessionRow & { class: { id: string; name: string; code: string; track: string | null } | null };

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher();
  const { data: session } = await supabase.from("sessions").select("*, class:classes(id, name, code, track)").eq("id", id).maybeSingle<SessionWithClass>();
  if (!session || !session.class) notFound();
  // Sessions from before terms carry an old snapshot: show what we can.
  const parsed = MissionSchema.safeParse(session.mission_snapshot);
  const mission = parsed.success ? parsed.data : null;
  const info = snapshotInfo(session.mission_snapshot);
  const over = sessionIsOver(session);
  const { count } = await supabase.from("participants").select("id", { count: "exact", head: true }).eq("session_id", id);

  const track = isTrack(session.class.track) ? session.class.track : "8-9";
  const end = endSession.bind(null, session.id);

  return (
    <div className="launch">
      <header className="topbar no-print" style={{ position: "static" }}>
        <div className="brand">
          <Link className="identity" href="/teacher">
            <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} />
          </Link>
          <span className="context">
            <Link href={`/teacher/class/${session.class.id}`} style={{ color: "inherit" }}>
              {session.class.name}
            </Link>
          </span>
        </div>
        <div className="topbar-actions">
          <Link className="btn" href={`/teacher/session/${session.id}/gallery`}>
            Gallery
          </Link>
          {over ? (
            <span className="chip">Ended {formatDateTime(session.ended_at)}</span>
          ) : (
            <ConfirmForm action={end} message="End the session for everyone? Kids will no longer be able to send messages, and the gallery is frozen.">
              <button className="btn btn-danger" type="submit">
                End session
              </button>
            </ConfirmForm>
          )}
        </div>
      </header>

      <main className="page" style={{ gap: 32, paddingTop: 24 }}>
        <div className="stack" style={{ alignItems: "center", gap: 12 }}>
          <p className="section-label">
            {weekLabel(session.week ?? info.week, info.title)}
          </p>
          {over ? (
            <>
              <p className="page-title" style={{ textAlign: "center" }}>
                This session has ended
              </p>
              <Link className="btn btn-primary" href={`/teacher/session/${session.id}/gallery`}>
                Open the group gallery
              </Link>
            </>
          ) : (
            <>
              <p className="launch-url">
                Go to <b>{joinUrlForDisplay()}</b>, type the code and tap your name
              </p>
              <p className="launch-code" aria-label={`Group code ${session.class.code.split("").join(" ")}`}>
                {session.class.code}
              </p>
              <JoinCount sessionId={session.id} initial={count ?? 0} live={!over} />
            </>
          )}
        </div>

        {mission && (
          <div className="grid grid-two" style={{ alignItems: "start" }}>
            <section className="card card-pad stack">
              <h2 className="section-label">Warm-up · 5 min</h2>
              <p className="launch-hook">{mission.teacher.warmUp}</p>
              <h2 className="section-label">Mini-lesson · 10 min</h2>
              <p className="launch-hook" style={{ fontSize: 17 }}>
                {mission.teacher.miniLesson}
              </p>
            </section>
            <section className="card card-pad stack">
              <h2 className="section-label">Studio time · what the kids see</h2>
              <p className="launch-hook" style={{ fontSize: 17 }}>
                {mission.kid.intro}
              </p>
              <ol className="brief-steps">
                {kidSteps(mission, track).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <h2 className="section-label">Share &amp; save · 10 min</h2>
              <p>{mission.teacher.shareSave}</p>
              {Object.entries(session.teacher_inputs).length > 0 && (
                <p className="meta">
                  {Object.entries(session.teacher_inputs)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(" · ")}
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="meta" style={{ padding: "0 24px 24px" }}>
        Started {formatDateTime(session.started_at)} · Sessions end automatically after three hours.
      </footer>
    </div>
  );
}
