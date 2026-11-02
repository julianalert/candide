import Link from "next/link";
import { notFound } from "next/navigation";
import { startSession } from "@/app/teacher/actions";
import { imageEnabled, MISSION_TYPE_LABEL, parseMission } from "@/lib/missions";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow, MissionRow } from "@/lib/types";

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; missionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, missionId } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireTeacher();
  const { data: klass } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassRow>();
  if (!klass) notFound();
  const { data: row } = await supabase.from("missions").select("*").eq("id", missionId).eq("published", true).maybeSingle<MissionRow>();
  if (!row) notFound();
  const mission = parseMission(row.json, row.id);

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">
            <Link href={`/teacher/class/${klass.id}`}>{klass.name}</Link> · <Link href={`/teacher/class/${klass.id}/missions`}>Missions</Link> · Mission{" "}
            {String(mission.number).padStart(2, "0")}
          </p>
          <h1>{mission.title}</h1>
          <p className="page-sub">{mission.idea}</p>
          <div className="actions">
            <span className="chip">{MISSION_TYPE_LABEL[mission.type]}</span>
            <span className="chip">{mission.durationMin} min</span>
            <span className="chip">Ages {mission.ageMin}–{mission.ageMax}</span>
            <span className="chip">{imageEnabled(mission) ? `Pictures on · ${mission.ai.imageStyle}` : "Chat only"}</span>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 0.6fr)", alignItems: "start" }}>
        <div className="card">
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Hook · 5 min</h2>
            <p>{mission.teacher.hook}</p>
          </section>
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Build · 25 min</h2>
            <p>
              Kids see: <i>{mission.kid.intro}</i>
            </p>
            <ol className="brief-steps">
              {mission.kid.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="meta">
              Stretch: {mission.teacher.stretch}
              <br />
              Simplify: {mission.teacher.simplify}
            </p>
          </section>
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Share · 10 min</h2>
            <p>{mission.teacher.share}</p>
          </section>
          <section className="brief-section" style={{ borderBottom: "1px solid var(--color-rule)" }}>
            <h2 className="section-label">Debrief · 5 min</h2>
            <p>{mission.teacher.debrief}</p>
          </section>
          <section className="brief-section">
            <h2 className="section-label">Under the hood</h2>
            <p>
              Every message passes a fixed safety layer, then this mission&rsquo;s instructions below, then an age-8-to-11 tone guide. Caps per child:{" "}
              {mission.ai.caps.messages} messages
              {imageEnabled(mission) ? `, ${mission.ai.caps.images} pictures, ${mission.ai.caps.imageRetriesPerPrompt} retries per picture` : ""}.
              {mission.ai.blockedTopics.length ? ` Extra blocked topics: ${mission.ai.blockedTopics.join(", ")}.` : ""}
              {mission.ai.features.includes("rulesBox") ? " Kids write their own rules in a box; those rules sit under the safety layer and can never override it." : ""}
            </p>
            <details>
              <summary className="meta" style={{ cursor: "pointer" }}>
                What the AI is told for this mission
              </summary>
              <pre className="prompt-box" style={{ marginTop: 10 }}>
                {mission.ai.systemPrompt}
              </pre>
            </details>
          </section>
        </div>

        <form action={startSession} className="card card-pad stack" style={{ position: "sticky", top: 84 }}>
          <input type="hidden" name="class_id" value={klass.id} />
          <input type="hidden" name="mission_id" value={mission.id} />
          <h2 className="card-title">Start this mission with {klass.name}</h2>
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
          <p className="meta">The launch page shows the class code and the hook in projector size. Kids can join as soon as you press start.</p>
          <button className="btn btn-primary" type="submit">
            Start session
          </button>
          <p className="caption">Starting a new session ends any session still open for this class.</p>
        </form>
      </div>
    </main>
  );
}
