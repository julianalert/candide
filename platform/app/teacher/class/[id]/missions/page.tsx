import Link from "next/link";
import { notFound } from "next/navigation";
import { imageEnabled, MISSION_TYPE_LABEL, parseMission } from "@/lib/missions";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow, MissionRow } from "@/lib/types";

export const metadata = { title: "Pick a mission" };

export default async function MissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher();
  const { data: klass } = await supabase.from("classes").select("*").eq("id", id).maybeSingle<ClassRow>();
  if (!klass) notFound();

  const { data: rows } = await supabase.from("missions").select("*").eq("published", true).order("number");
  const missions = ((rows ?? []) as MissionRow[]).map((row) => parseMission(row.json, row.id));

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">
            <Link href="/teacher">Classes</Link> · <Link href={`/teacher/class/${klass.id}`}>{klass.name}</Link>
          </p>
          <h1>Pick a mission</h1>
          <p className="page-sub">Ten scripted 45-minute missions. Open one to read the brief, then start the session from the brief page.</p>
        </div>
      </div>

      {missions.length === 0 ? (
        <div className="card card-pad">
          <p className="meta">
            No missions are loaded yet. Run <code className="mono">npm run seed</code> to load the mission library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cards">
          {missions.map((mission) => (
            <Link key={mission.id} href={`/teacher/class/${klass.id}/missions/${mission.id}`} className="card tile" style={{ color: "inherit" }}>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <span className="mono" style={{ color: "var(--color-petrol)", fontWeight: 500 }}>
                  {String(mission.number).padStart(2, "0")}
                </span>
                <span className="chip">{MISSION_TYPE_LABEL[mission.type]}</span>
              </div>
              <h2 className="card-title">{mission.title}</h2>
              <p>{mission.idea}</p>
              <span className="meta">
                {mission.durationMin} min · {imageEnabled(mission) ? "Pictures on" : "Chat only"}
                {mission.teacherInputs.length ? " · needs a topic" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
