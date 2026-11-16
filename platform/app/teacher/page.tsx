import Link from "next/link";
import { TRACK_LABEL, isTrack } from "@/lib/missions";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow, TermRow } from "@/lib/types";
import { createClass } from "./actions";

export const metadata = { title: "Clubs" };

type ClubWithSessions = ClassRow & { sessions: { id: string; week: number | null }[]; term: { title: string; number: number } | null };

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, userId } = await requireTeacher();
  const params = await searchParams;
  const [{ data }, { data: termRows }] = await Promise.all([
    supabase.from("classes").select("*, sessions(id, week), term:terms(title, number)").eq("teacher_id", userId).order("created_at", { ascending: false }),
    supabase.from("terms").select("id, number, title, json").eq("published", true).order("number"),
  ]);
  const clubs = (data ?? []) as ClubWithSessions[];
  const terms = (termRows ?? []) as Pick<TermRow, "id" | "number" | "title" | "json">[];

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <h1>Your clubs</h1>
          <p className="page-sub">
            Each club group follows a term, one mission a week. Children join with the club code and tap their name on the club list, so their work follows them all term.
          </p>
        </div>
      </div>

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <section className="section">
          <h2 className="section-title">Club groups</h2>
          {clubs.length === 0 ? (
            <div className="card card-pad">
              <p className="meta">No clubs yet. Create your first one on the right: it takes ten seconds.</p>
            </div>
          ) : (
            <div className="card list">
              {clubs.map((club) => {
                const weeksRun = new Set(club.sessions.map((s) => s.week).filter(Boolean)).size;
                return (
                  <Link key={club.id} href={`/teacher/class/${club.id}`} className="item-row" style={{ color: "inherit" }}>
                    <div className="grow">
                      <b>{club.name}</b>
                      <span className="meta">
                        {club.term ? `Term ${club.term.number} · ${club.term.title}` : "Term"} · {isTrack(club.track) ? TRACK_LABEL[club.track] : ""} · {weeksRun} week
                        {weeksRun === 1 ? "" : "s"} run
                      </span>
                    </div>
                    <span className="mono" style={{ fontSize: 18, letterSpacing: "0.12em", color: "var(--color-petrol)" }}>
                      {club.code}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="section">
          <h2 className="section-title">New club group</h2>
          <form action={createClass} className="card stack card-pad">
            {params.error === "class" && (
              <div className="notice notice-error">
                <span>Give the club a name, then pick an age track and a term.</span>
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="name">
                Club name
              </label>
              <input className="input" id="name" name="name" required maxLength={60} placeholder="e.g. Comic Club, Tuesday group" />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="track">
                  Age track
                </label>
                <select className="input" id="track" name="track" defaultValue="8-9" required>
                  <option value="8-9">{TRACK_LABEL["8-9"]}</option>
                  <option value="10-11">{TRACK_LABEL["10-11"]}</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="term_id">
                  Term
                </label>
                <select className="input" id="term_id" name="term_id" defaultValue={terms[0]?.id} required>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      Term {term.number} · {term.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {terms.length === 0 && (
              <p className="meta">
                No terms are loaded yet. Run <code className="mono">npm run seed</code> to load the curriculum.
              </p>
            )}
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={terms.length === 0}>
                Create club
              </button>
              <span className="meta">You&rsquo;ll get the club code straight away.</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
