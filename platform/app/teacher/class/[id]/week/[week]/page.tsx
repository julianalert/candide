import Link from "next/link";
import { notFound } from "next/navigation";
import { startSession } from "@/app/teacher/actions";
import { TRACK_LABEL, chatEnabled, imageEnabled, isTrack, kidSteps, parseMission } from "@/lib/missions";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow, MissionRow } from "@/lib/types";

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; week: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, week: weekParam } = await params;
  const { error } = await searchParams;
  const week = Number(weekParam);
  if (!Number.isInteger(week)) notFound();

  const { supabase } = await requireTeacher();
  const { data: klass } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassRow>();
  if (!klass) notFound();
  const { data: row } = await supabase.from("missions").select("*").eq("term_id", klass.term_id).eq("week", week).eq("published", true).maybeSingle<MissionRow>();
  if (!row) notFound();
  const mission = parseMission(row.json, row.id);
  const track = isTrack(klass.track) ? klass.track : "8-9";
  const other = track === "8-9" ? "10-11" : "8-9";
  const steps = kidSteps(mission, track);
  const { count: alreadyRun } = await supabase.from("sessions").select("id", { count: "exact", head: true }).eq("class_id", klass.id).eq("week", week);

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">
            <Link href={`/teacher/class/${klass.id}`}>{klass.name}</Link> · {mission.phase} · Week {mission.week}
          </p>
          <h1>{mission.title}</h1>
          <p className="page-sub">{mission.skill}</p>
          <div className="actions">
            <span className="chip">{mission.durationMin} min</span>
            <span className="chip">{TRACK_LABEL[track]}</span>
            <span className="chip">Output: {mission.output}</span>
            <span className="chip">
              {mission.paperOnly ? "On paper, no AI" : imageEnabled(mission) ? "Chat + pictures" : chatEnabled(mission) ? "Chat only" : "No AI"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 0.6fr)", alignItems: "start" }}>
        <div className="card">
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Warm-up · 5 min</h2>
            <p>{mission.teacher.warmUp}</p>
          </section>
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Mini-lesson · 10 min</h2>
            <p>{mission.teacher.miniLesson}</p>
          </section>
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Studio time · 35 min</h2>
            <p>{mission.teacher.studio}</p>
            <p>
              Kids see: <i>{mission.kid.intro}</i>
            </p>
            <ol className="brief-steps">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {mission.tracks[other].steps && (
              <p className="meta">
                {TRACK_LABEL[other]} get different steps: {mission.tracks[other].steps!.join(" ")}
              </p>
            )}
          </section>
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Share &amp; save · 10 min</h2>
            <p>{mission.teacher.shareSave}</p>
            {mission.teacher.printables.length > 0 && <p className="meta">Printables: {mission.teacher.printables.join(", ")}.</p>}
          </section>
          <section className="brief-section">
            <h2 className="section-label">Under the hood</h2>
            {mission.paperOnly ? (
              <p>This is a paper week. Children can open the platform to look at their board, but there is no AI helper and no pictures.</p>
            ) : (
              <>
                <p>
                  Every message passes a fixed safety layer, then this week&rsquo;s instructions, the notes for {TRACK_LABEL[track].toLowerCase()}, a summary of what the child pinned in earlier weeks, and an age guide. Caps per child this week:{" "}
                  {mission.ai.caps.messages} messages
                  {imageEnabled(mission) ? `, ${mission.ai.caps.images} pictures, ${mission.ai.caps.imageRetriesPerPrompt + 1} tries per picture` : ""}.
                </p>
                <details>
                  <summary className="meta" style={{ cursor: "pointer" }}>
                    What the AI is told this week
                  </summary>
                  <pre className="prompt-box" style={{ marginTop: 10 }}>
                    {mission.ai.systemPrompt}
                    {"\n\n"}
                    {TRACK_LABEL[track]}: {mission.tracks[track].aiNotes}
                  </pre>
                </details>
              </>
            )}
          </section>
        </div>

        <form action={startSession} className="card card-pad stack" style={{ position: "sticky", top: 84 }}>
          <input type="hidden" name="class_id" value={klass.id} />
          <input type="hidden" name="week" value={mission.week} />
          <h2 className="card-title">
            Start week {mission.week} with {klass.name}
          </h2>
          {error === "inputs" && (
            <div className="notice notice-error">
              <span>Fill in the field below before starting.</span>
            </div>
          )}
          {mission.teacherInputs.map((input) => (
            <div className="field" key={input.key}>
              <label className="label" htmlFor={`input_${input.key}`}>
                {input.label}
              </label>
              <input className="input" id={`input_${input.key}`} name={`input_${input.key}`} placeholder={input.placeholder} required maxLength={200} />
            </div>
          ))}
          <p className="meta">The class screen shows the club code, the warm-up and the mini-lesson. Kids can join as soon as you press start.</p>
          <button className="btn btn-primary" type="submit">
            {alreadyRun ? "Run this week again" : "Start the session"}
          </button>
          <p className="caption">
            Starting ends any session still open for this club.{alreadyRun ? " Children keep what they pinned last time." : ""}
          </p>
        </form>
      </div>
    </main>
  );
}
