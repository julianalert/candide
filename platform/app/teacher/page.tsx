import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher";
import type { ClassRow } from "@/lib/types";
import { createClass } from "./actions";

export const metadata = { title: "Classes" };

type ClassWithSessions = ClassRow & { sessions: { id: string; started_at: string }[] };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, userId } = await requireTeacher();
  const params = await searchParams;
  const { data } = await supabase
    .from("classes")
    .select("*, sessions(id, started_at)")
    .eq("teacher_id", userId)
    .order("created_at", { ascending: false });
  const classes = (data ?? []) as ClassWithSessions[];

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <h1>Your classes</h1>
          <p className="page-sub">Each class has a permanent six-character code. Start a mission from a class and kids join with the code and their first name.</p>
        </div>
      </div>

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <section className="section">
          <h2 className="section-title">Classes</h2>
          {classes.length === 0 ? (
            <div className="card card-pad">
              <p className="meta">No classes yet. Create your first one on the right: it takes ten seconds.</p>
            </div>
          ) : (
            <div className="card list">
              {classes.map((klass) => {
                const last = klass.sessions.map((s) => s.started_at).sort().at(-1);
                return (
                  <Link key={klass.id} href={`/teacher/class/${klass.id}`} className="item-row" style={{ color: "inherit" }}>
                    <div className="grow">
                      <b>{klass.name}</b>
                      <span className="meta">
                        Year {klass.year_group} · {klass.sessions.length} session{klass.sessions.length === 1 ? "" : "s"}
                        {last ? ` · last ${formatDate(last)}` : ""}
                      </span>
                    </div>
                    <span className="mono" style={{ fontSize: 18, letterSpacing: "0.12em", color: "var(--color-petrol)" }}>
                      {klass.code}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="section">
          <h2 className="section-title">New class</h2>
          <form action={createClass} className="card stack card-pad">
            {params.error === "class" && (
              <div className="notice notice-error">
                <span>Give the class a name and pick a year group.</span>
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="name">
                Class name
              </label>
              <input className="input" id="name" name="name" required maxLength={60} placeholder="e.g. 5B, Dolphins, Ms Khan's class" />
            </div>
            <div className="field">
              <label className="label" htmlFor="year_group">
                Year group
              </label>
              <select className="input" id="year_group" name="year_group" defaultValue="4" required>
                {[3, 4, 5, 6].map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit">
                Create class
              </button>
              <span className="meta">You&rsquo;ll get the class code straight away.</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
