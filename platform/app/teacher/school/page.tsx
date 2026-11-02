import Link from "next/link";
import { deleteSession, inviteTeacher } from "@/app/teacher/actions";
import { ConfirmForm } from "@/components/confirm-form";
import { sessionIsOver } from "@/lib/caps";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/teacher";
import type { Profile, School } from "@/lib/types";

export const metadata = { title: "School" };

type SessionSummary = {
  id: string;
  started_at: string;
  ended_at: string | null;
  title: string | null;
  class: { name: string; teacher: { display_name: string | null } | null } | null;
};

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ invited?: string; error?: string; deleted?: string }> }) {
  const params = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const [{ data: school }, { data: teacherRows }, { data: sessionRows }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", profile.school_id).maybeSingle<School>(),
    supabase.from("profiles").select("*").eq("school_id", profile.school_id).order("display_name"),
    supabase
      .from("sessions")
      .select("id, started_at, ended_at, title:mission_snapshot->>title, class:classes(name, teacher:profiles(display_name))")
      .order("started_at", { ascending: false })
      .limit(100),
  ]);
  const teachers = (teacherRows ?? []) as Profile[];
  const sessions = (sessionRows ?? []) as unknown as SessionSummary[];

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">School</p>
          <h1>{school?.name ?? "Your school"}</h1>
          <p className="page-sub">Invite teachers, and see every gallery run in the school. Teachers&rsquo; emails are visible here and nowhere else.</p>
        </div>
      </div>

      {params.invited && (
        <div className="notice notice-good">
          <span>
            Invitation sent to <b>{params.invited}</b>. They&rsquo;ll get an email with a link that signs them in.
          </span>
        </div>
      )}
      {params.deleted && (
        <div className="notice notice-good">
          <span>Session deleted, with every message, pin and picture under it.</span>
        </div>
      )}
      {params.error && (
        <div className="notice notice-error">
          <span>{params.error}</span>
        </div>
      )}

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <section className="section">
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Teachers</h2>
              <span className="meta">{teachers.length}</span>
            </div>
            <div className="list">
              {teachers.map((teacher) => (
                <div key={teacher.id} className="item-row">
                  <div className="grow">
                    <b>{teacher.display_name ?? teacher.email}</b>
                    <span className="meta">{teacher.email}</span>
                  </div>
                  <span className="chip">{teacher.role === "admin" ? "School admin" : "Teacher"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <form action={inviteTeacher} className="card card-pad stack">
            <h2 className="card-title">Invite a teacher</h2>
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="display_name">
                  Name
                </label>
                <input className="input" id="display_name" name="display_name" maxLength={60} placeholder="Ms Khan" />
              </div>
              <div className="field">
                <label className="label" htmlFor="role">
                  Role
                </label>
                <select className="input" id="role" name="role" defaultValue="teacher">
                  <option value="teacher">Teacher</option>
                  <option value="admin">School admin</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="email">
                School email
              </label>
              <input className="input" id="email" name="email" type="email" required placeholder="teacher@school.edu" />
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit">
                Send invitation
              </button>
              <span className="meta">They sign in with email links, no password.</span>
            </div>
          </form>
        </section>
      </div>

      <section className="section">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">All sessions</h2>
            <span className="meta">Most recent first · deleting removes everything under a session</span>
          </div>
          {sessions.length === 0 ? (
            <p className="meta card-pad">No sessions have been run yet.</p>
          ) : (
            <div className="list">
              {sessions.map((session) => (
                <div key={session.id} className="item-row">
                  <div className="grow">
                    <b>{session.title ?? "Mission"}</b>
                    <span className="meta">
                      {session.class?.name ?? "Class"} · {session.class?.teacher?.display_name ?? "Teacher"} · {formatDateTime(session.started_at)}
                    </span>
                  </div>
                  {sessionIsOver(session) ? <span className="chip">Ended</span> : <span className="chip chip-live">Live</span>}
                  <Link className="btn" href={`/teacher/session/${session.id}/gallery`}>
                    Gallery
                  </Link>
                  <ConfirmForm action={deleteSession} message="Delete this session and everything under it: every child's messages, pins and pictures? This cannot be undone.">
                    <input type="hidden" name="session_id" value={session.id} />
                    <button className="btn btn-danger" type="submit">
                      Delete
                    </button>
                  </ConfirmForm>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
