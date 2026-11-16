import Link from "next/link";
import { notFound } from "next/navigation";
import { addKids, removeKid } from "@/app/teacher/actions";
import { sessionIsOver } from "@/lib/caps";
import { joinUrlForDisplay } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { TRACK_LABEL, isTrack, parseMission, parseTerm, type Mission, type Term } from "@/lib/missions";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow, Kid, MissionRow, TermRow } from "@/lib/types";

type SessionSummary = { id: string; started_at: string; ended_at: string | null; week: number | null };

type Search = { added?: string; skipped?: string; error?: string };

export default async function ClubPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const search = await searchParams;
  const { supabase } = await requireTeacher();
  const { data: klass } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassRow>();
  if (!klass) notFound();

  const [{ data: termRow }, { data: missionRows }, { data: sessionRows }, { data: kidRows }] = await Promise.all([
    supabase.from("terms").select("*").eq("id", klass.term_id).maybeSingle<TermRow>(),
    supabase.from("missions").select("*").eq("term_id", klass.term_id).eq("published", true).order("week"),
    supabase.from("sessions").select("id, started_at, ended_at, week").eq("class_id", id).order("started_at", { ascending: false }),
    supabase.from("kids").select("*").eq("class_id", id).is("archived_at", null).order("display_name"),
  ]);

  let term: Term | null = null;
  try {
    term = termRow ? parseTerm(termRow.json, termRow.id) : null;
  } catch {
    term = null;
  }
  const missions = ((missionRows ?? []) as MissionRow[]).map((row) => parseMission(row.json, row.id));
  const sessions = (sessionRows ?? []) as SessionSummary[];
  const kids = (kidRows ?? []) as Kid[];
  const live = sessions.find((s) => !sessionIsOver(s));
  const nextWeek = missions.find((m) => !sessions.some((s) => s.week === m.week))?.week ?? null;
  const track = isTrack(klass.track) ? klass.track : "8-9";

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">
            <Link href="/teacher">Clubs</Link> · {term ? `Term ${term.number} · ${term.title}` : "Term"} · {TRACK_LABEL[track]}
          </p>
          <h1>{klass.name}</h1>
          {term && <p className="page-sub">{term.goal}</p>}
        </div>
        <div className="actions">
          {live ? (
            <Link className="btn btn-primary" href={`/teacher/session/${live.id}`}>
              Open the class screen
            </Link>
          ) : nextWeek ? (
            <Link className="btn btn-primary" href={`/teacher/class/${klass.id}/week/${nextWeek}`}>
              Start week {nextWeek}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card card-pad stack" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
            <span className="section-label">Club code</span>
            <span className="mono" style={{ fontSize: "clamp(48px, 7vw, 84px)", letterSpacing: "0.16em", color: "var(--color-petrol)", lineHeight: 1 }}>
              {klass.code}
            </span>
            <span className="meta">
              Kids go to <b>{joinUrlForDisplay()}</b>, type this code and tap their name. It never changes.
            </span>
          </div>

          <section className="card" aria-labelledby="club-list">
            <div className="card-head">
              <h2 className="card-title" id="club-list">
                Club list
              </h2>
              <span className="meta">
                {kids.length} {kids.length === 1 ? "child" : "children"}
              </span>
            </div>
            {search.added && (
              <div className="notice notice-good" style={{ margin: "0 24px 12px" }}>
                <span>
                  Added {search.added} {search.added === "1" ? "name" : "names"}
                  {search.skipped ? `; ${search.skipped} already on the list` : ""}.
                </span>
              </div>
            )}
            {search.error === "names" && (
              <div className="notice notice-error" style={{ margin: "0 24px 12px" }}>
                <span>Type at least one first name.</span>
              </div>
            )}
            {kids.length > 0 && (
              <div className="list">
                {kids.map((kid) => (
                  <div key={kid.id} className="item-row" style={{ padding: "10px 24px" }}>
                    <b className="grow">{kid.display_name}</b>
                    <form action={removeKid}>
                      <input type="hidden" name="class_id" value={klass.id} />
                      <input type="hidden" name="kid_id" value={kid.id} />
                      <button className="btn" type="submit" style={{ minHeight: 32 }}>
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <form action={addKids} className="stack card-pad" style={{ borderTop: "1px solid var(--color-rule)" }}>
              <input type="hidden" name="class_id" value={klass.id} />
              <label className="label" htmlFor="names">
                Add children
              </label>
              <textarea className="input" id="names" name="names" rows={4} placeholder={"One first name per line\nSam\nLina\nOmar K."} />
              <div className="actions">
                <button className="btn btn-primary" type="submit">
                  Add to the list
                </button>
                <span className="caption">First names only. Two children with the same name? Add an initial.</span>
              </div>
            </form>
          </section>
        </div>

        <section className="card" aria-labelledby="weeks">
          <div className="card-head">
            <h2 className="card-title" id="weeks">
              {term ? `Term ${term.number} · ${term.title}` : "Weeks"}
            </h2>
            <span className="meta">
              {new Set(sessions.map((s) => s.week).filter(Boolean)).size} of {missions.length} weeks run
            </span>
          </div>
          {missions.length === 0 ? (
            <p className="meta card-pad">
              This term has no missions loaded yet. Run <code className="mono">npm run seed</code>.
            </p>
          ) : (
            <ol className="list">
              {missions.map((mission) => (
                <WeekRow key={mission.id} mission={mission} classId={klass.id} sessions={sessions.filter((s) => s.week === mission.week)} isNext={mission.week === nextWeek} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function WeekRow({ mission, classId, sessions, isNext }: { mission: Mission; classId: string; sessions: SessionSummary[]; isNext: boolean }) {
  const live = sessions.find((s) => !sessionIsOver(s));
  const latest = sessions[0];
  return (
    <li className="item-row">
      <span className="mono" style={{ color: "var(--color-petrol)" }}>
        {String(mission.week).padStart(2, "0")}
      </span>
      <div className="grow">
        <b>{mission.title}</b>
        <span className="meta">
          {mission.phase}
          {mission.paperOnly ? " · on paper" : ""}
          {latest ? ` · run ${formatDate(latest.started_at)}` : ""}
        </span>
      </div>
      {live ? (
        <>
          <span className="chip chip-live">Live</span>
          <Link className="btn" href={`/teacher/session/${live.id}`}>
            Class screen
          </Link>
        </>
      ) : latest ? (
        <>
          <span className="chip">Done</span>
          <Link className="btn" href={`/teacher/session/${latest.id}/gallery`}>
            Gallery
          </Link>
          <Link className="btn" href={`/teacher/class/${classId}/week/${mission.week}`} title="Read the script or run this week again">
            Script
          </Link>
        </>
      ) : (
        <>
          {isNext && <span className="chip chip-petrol">Next</span>}
          <Link className="btn" href={`/teacher/class/${classId}/week/${mission.week}`}>
            {isNext ? "Open" : "Preview"}
          </Link>
        </>
      )}
    </li>
  );
}
