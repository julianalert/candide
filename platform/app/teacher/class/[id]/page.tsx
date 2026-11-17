import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addKids, removeKid, setClubManager, updateClubSchedule } from "@/app/teacher/actions";
import { ManagerPicker } from "@/components/manager-picker";
import { sessionIsOver } from "@/lib/caps";
import { joinUrlForDisplay } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { TRACK_LABEL, isTrack, parseMission, parseTerm, type Mission, type Term } from "@/lib/missions";
import { pendingInvites } from "@/lib/invites";
import { DAYS, meetsLabel, shortDay, weekDate } from "@/lib/schedule";
import { isAdminProfile, requireTeacher } from "@/lib/teacher";
import type { ClassRow, Kid, MissionRow, Profile, TermRow } from "@/lib/types";

type SessionSummary = { id: string; started_at: string; ended_at: string | null; week: number | null };

type Search = { added?: string; skipped?: string; error?: string; manager?: string; manager_error?: string; schedule?: string };

export default async function ClubPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const search = await searchParams;
  const { supabase, userId, profile } = await requireTeacher();
  const { data: klass } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassRow>();
  if (!klass) notFound();
  const admin = isAdminProfile(profile);
  const isManager = klass.teacher_id === userId;
  // Teachers see the clubs they run; admins see every club in the school.
  if (!admin && !isManager) redirect("/teacher/groups");

  const [{ data: termRow }, { data: missionRows }, { data: sessionRows }, { data: kidRows }, { data: peopleRows }] = await Promise.all([
    supabase.from("terms").select("*").eq("id", klass.term_id).maybeSingle<TermRow>(),
    supabase.from("missions").select("*").eq("term_id", klass.term_id).eq("published", true).order("week"),
    supabase.from("sessions").select("id, started_at, ended_at, week").eq("class_id", id).order("started_at", { ascending: false }),
    supabase.from("kids").select("*").eq("class_id", id).is("archived_at", null).order("display_name"),
    supabase.from("profiles").select("*").eq("school_id", klass.school_id).order("display_name"),
  ]);
  const people = (peopleRows ?? []) as Profile[];
  const manager = people.find((p) => p.id === klass.teacher_id) ?? null;
  const pending = admin ? await pendingInvites(people.map((p) => p.id)) : new Set<string>();
  const managerName = isManager ? "you" : manager?.display_name || manager?.email || "a teacher";
  const meets = meetsLabel(klass.meets_day, klass.meets_time);

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
  const startsOn = klass.starts_on;
  const firstWeek = weekDate(startsOn, klass.meets_day, 1);
  const fresh = kids.length === 0 && sessions.length === 0;

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">
            {admin && !isManager ? <Link href="/teacher/school">School</Link> : <Link href="/teacher/groups">My groups</Link>} · {term ? `Term ${term.number} · ${term.title}` : "Term"} ·{" "}
            {TRACK_LABEL[track]}
          </p>
          <h1>{klass.name}</h1>
          <p className="page-sub">
            Run by {managerName}
            {pending.has(klass.teacher_id) ? " (invite not accepted yet)" : ""}
            {meets ? ` · ${meets}` : ""}. {term?.goal}
          </p>
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

      {search.manager === "changed" && (
        <div className="notice notice-good">
          <span>Teacher changed. The group now appears in their &ldquo;My groups&rdquo;.</span>
        </div>
      )}
      {search.schedule === "saved" && (
        <div className="notice notice-good">
          <span>Schedule saved. Each week now shows its date.</span>
        </div>
      )}
      {search.schedule === "denied" && (
        <div className="notice notice-error">
          <span>Only the group&rsquo;s teacher or a school admin can change its schedule.</span>
        </div>
      )}
      {search.manager_error && (
        <div className="notice notice-error">
          <span>{search.manager_error}</span>
        </div>
      )}

      {fresh && (isManager || admin) && (
        <section className="card" aria-labelledby="get-started">
          <div className="card-head">
            <h2 className="card-title" id="get-started">
              Get your group started
            </h2>
            <span className="meta">About ten minutes, once</span>
          </div>
          <ol className="list">
            <li className="item-row">
              <span className="chip">1</span>
              <div className="grow">
                <b>Read how a session runs</b>
                <span className="meta">Every week has the same hour: warm-up, mini-lesson, studio time, share and save. The script shows on the class screen.</span>
              </div>
              {missions[0] && (
                <Link className="btn" href={`/teacher/class/${klass.id}/week/${missions[0].week}`}>
                  Read week 1
                </Link>
              )}
            </li>
            <li className="item-row">
              <span className="chip">2</span>
              <div className="grow">
                <b>Add the children to the list</b>
                <span className="meta">First names only. Each week they type the group code and tap their name.</span>
              </div>
              <a className="btn" href="#club-list">
                Add names
              </a>
            </li>
            <li className="item-row">
              <span className="chip">3</span>
              <div className="grow">
                <b>Start week 1 on the day</b>
                <span className="meta">
                  {firstWeek ? `Planned for ${shortDay(firstWeek)}. ` : "Set the day and the first week in Schedule to see the date. "}
                  Press start at the beginning of the session and put the class screen up.
                </span>
              </div>
            </li>
          </ol>
        </section>
      )}

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="card card-pad stack" style={{ alignItems: "center", textAlign: "center", gap: 10 }}>
            <span className="section-label">Group code</span>
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
                Children
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

          {(isManager || admin) && (
            <form action={updateClubSchedule} className="card card-pad stack" aria-labelledby="schedule-title">
              <input type="hidden" name="class_id" value={klass.id} />
              <h2 className="card-title" id="schedule-title">
                Schedule
              </h2>
              <div className="field-row">
                <div className="field">
                  <label className="label" htmlFor="meets_day">
                    Meets on
                  </label>
                  <select className="input" id="meets_day" name="meets_day" defaultValue={klass.meets_day ?? ""}>
                    <option value="">Not decided yet</option>
                    {DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}s
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="meets_time">
                    At
                  </label>
                  <input className="input" id="meets_time" name="meets_time" type="time" step={300} defaultValue={klass.meets_time ?? ""} />
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="starts_on">
                  First week starts
                </label>
                <input className="input" id="starts_on" name="starts_on" type="date" defaultValue={klass.starts_on ?? ""} />
                <span className="caption">
                  {firstWeek && missions.length
                    ? `Week 1: ${shortDay(firstWeek)} · Comic Con (week ${missions.length}): ${shortDay(weekDate(startsOn, klass.meets_day, missions.length))}.`
                    : "Week 1 is the first meeting day from this date."}
                </span>
              </div>
              <div className="actions">
                <button className="btn" type="submit">
                  Save schedule
                </button>
              </div>
            </form>
          )}

          {admin && (
            <form action={setClubManager} className="card card-pad stack" aria-labelledby="manager-title">
              <input type="hidden" name="class_id" value={klass.id} />
              <h2 className="card-title" id="manager-title">
                Teacher
              </h2>
              <p className="meta">
                This teacher runs the weekly sessions and sees this group in &ldquo;My groups&rdquo;. As school admin you can open any group and start a session to cover for them.
              </p>
              <ManagerPicker
                colleagues={people.filter((p) => p.id !== userId).map((p) => ({ id: p.id, name: p.display_name || p.email || "Colleague", pending: pending.has(p.id) }))}
                defaultValue={klass.teacher_id === userId ? "me" : klass.teacher_id}
              />
              <div className="actions">
                <button className="btn" type="submit">
                  Save teacher
                </button>
              </div>
            </form>
          )}
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
                <WeekRow
                  key={mission.id}
                  mission={mission}
                  classId={klass.id}
                  sessions={sessions.filter((s) => s.week === mission.week)}
                  isNext={mission.week === nextWeek}
                  planned={shortDay(weekDate(startsOn, klass.meets_day, mission.week))}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function WeekRow({ mission, classId, sessions, isNext, planned }: { mission: Mission; classId: string; sessions: SessionSummary[]; isNext: boolean; planned: string }) {
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
          {latest ? ` · run ${formatDate(latest.started_at)}` : planned ? ` · ${planned}` : ""}
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
