import Link from "next/link";
import { createClub, deleteSession, inviteTeacher, resendColleagueInvite } from "@/app/teacher/actions";
import { ConfirmForm } from "@/components/confirm-form";
import { CopyText } from "@/components/copy-text";
import { ManagerPicker } from "@/components/manager-picker";
import { sessionIsOver } from "@/lib/caps";
import { parentClubDescription } from "@/lib/club-copy";
import { formatDateTime, weekLabel } from "@/lib/format";
import { pendingInvites } from "@/lib/invites";
import { TRACK_LABEL, isTrack, type Term } from "@/lib/missions";
import { DAYS, longDay, meetsLabel, shortDay, weekDate } from "@/lib/schedule";
import { requireAdmin } from "@/lib/teacher";
import type { ClassRow, Profile, School, TermRow } from "@/lib/types";

export const metadata = { title: "School" };

type SessionSummary = {
  id: string;
  started_at: string;
  ended_at: string | null;
  week: number | null;
  title: string | null;
  class: { name: string; teacher: { display_name: string | null } | null } | null;
};

type Club = ClassRow & {
  sessions: { id: string; week: number | null; started_at: string; ended_at: string | null }[];
  term: Pick<TermRow, "title" | "number" | "json"> | null;
};

type Search = {
  invited?: string;
  error?: string;
  deleted?: string;
  welcome?: string;
  saved?: string;
  created?: string;
  invited_manager?: string;
  resent?: string;
  club_error?: string;
};

export default async function SchoolPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { supabase, userId, profile } = await requireAdmin();
  const [{ data: school }, { data: peopleRows }, { data: clubRows }, { data: kidRows }, { data: termRows }, { data: sessionRows }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", profile.school_id).maybeSingle<School>(),
    supabase.from("profiles").select("*").eq("school_id", profile.school_id).order("display_name"),
    supabase
      .from("classes")
      .select("*, sessions(id, week, started_at, ended_at), term:terms(title, number, json)")
      .eq("school_id", profile.school_id)
      .order("created_at"),
    supabase.from("kids").select("class_id").is("archived_at", null),
    supabase.from("terms").select("id, number, title").eq("published", true).order("number"),
    supabase
      .from("sessions")
      .select("id, started_at, ended_at, week, title:mission_snapshot->>title, class:classes(name, teacher:profiles(display_name))")
      .order("started_at", { ascending: false })
      .limit(100),
  ]);
  const people = (peopleRows ?? []) as Profile[];
  const clubs = (clubRows ?? []) as Club[];
  const terms = (termRows ?? []) as Pick<TermRow, "id" | "number" | "title">[];
  const sessions = (sessionRows ?? []) as unknown as SessionSummary[];
  const pending = await pendingInvites(people.map((p) => p.id));

  const kidsPerClub = new Map<string, number>();
  for (const kid of (kidRows ?? []) as { class_id: string }[]) kidsPerClub.set(kid.class_id, (kidsPerClub.get(kid.class_id) ?? 0) + 1);
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const nameOf = (id: string) => {
    const person = peopleById.get(id);
    return person?.display_name || person?.email || "Someone";
  };
  const colleagues = people.filter((p) => p.id !== userId).map((p) => ({ id: p.id, name: p.display_name || p.email || "Colleague", pending: pending.has(p.id) }));

  // ---------- Setup checklist ----------
  const pendingManagers = [...new Set(clubs.map((c) => c.teacher_id).filter((id) => pending.has(id)))];
  const steps = [
    // Done as soon as the welcome screen is saved; the term start is optional and can come later.
    {
      done: Boolean(profile.onboarded_at),
      title: "Confirm your school",
      detail: school?.term_start
        ? `Term starts ${longDay(new Date(`${school.term_start}T00:00:00Z`))}.`
        : "No term start yet: add it from School details when you know it, and each week gets a date.",
      href: "/teacher/welcome?edit=1",
      cta: "Edit details",
    },
    { done: clubs.length > 0, title: "Create your club groups", detail: "One per group of children, each with an age track and a manager who runs it.", href: "#new-club", cta: "Create a club" },
    { done: clubs.length > 0 && pendingManagers.length === 0, title: "Managers accept their invites", detail: pendingManagers.length ? `Waiting for ${pendingManagers.map(nameOf).join(", ")}.` : "Everyone who runs a club has joined.", href: "#people", cta: "See teachers" },
    { done: clubs.length > 0 && clubs.every((c) => (kidsPerClub.get(c.id) ?? 0) > 0), title: "Fill each club list", detail: "The manager types the children’s first names once, from the club page.", href: "#clubs", cta: "See clubs" },
    { done: clubs.length > 0 && clubs.every((c) => c.sessions.length > 0), title: "Start week 1", detail: "Share the club description with parents first, then each manager starts week 1 on the day.", href: "#parents", cta: "For parents" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const where = [school?.city, school?.country].filter(Boolean).join(", ");

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <p className="section-label">School{where ? ` · ${where}` : ""}</p>
          <h1>{school?.name ?? "Your school"}</h1>
          <p className="page-sub">
            {school?.term_start ? `Term starts ${longDay(new Date(`${school.term_start}T00:00:00Z`))}. ` : ""}
            Create the club groups, choose who runs each one, and follow every club from here.
          </p>
        </div>
        <div className="actions">
          <Link className="btn" href="/teacher/welcome?edit=1">
            Edit school details
          </Link>
          <a className="btn btn-primary" href="#new-club">
            New club
          </a>
        </div>
      </div>

      {params.welcome && (
        <div className="notice notice-good">
          <span>
            {school?.name ?? "Your school"} is set up. Next: create your first club group and choose who runs it.
          </span>
        </div>
      )}
      {params.saved && (
        <div className="notice notice-good">
          <span>School details saved.</span>
        </div>
      )}
      {params.created && (
        <div className="notice notice-good">
          <span>
            Club <b>{params.created}</b> created.{params.invited_manager ? " Its manager got an email to join; the club appears for them as soon as they sign in." : ""}
          </span>
        </div>
      )}
      {params.invited && (
        <div className="notice notice-good">
          <span>
            Invitation sent to <b>{params.invited}</b>. They&rsquo;ll get an email with a link that signs them in.
          </span>
        </div>
      )}
      {params.resent && (
        <div className="notice notice-good">
          <span>Invitation sent again.</span>
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

      {!allDone && (
        <section className="card" aria-labelledby="setup">
          <div className="card-head">
            <h2 className="card-title" id="setup">
              Getting your school ready
            </h2>
            <span className="meta">
              {doneCount} of {steps.length} done
            </span>
          </div>
          <ol className="list">
            {steps.map((step, index) => (
              <li key={step.title} className="item-row">
                <span className={`chip${step.done ? " chip-live" : ""}`} aria-label={step.done ? "Done" : "To do"} style={{ minWidth: 28, textAlign: "center" }}>
                  {step.done ? "✓" : index + 1}
                </span>
                <div className="grow">
                  <b>{step.title}</b>
                  <span className="meta">{step.detail}</span>
                </div>
                {!step.done && (
                  <a className="btn" href={step.href}>
                    {step.cta}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-two" style={{ alignItems: "start" }}>
        <section className="card" id="clubs" aria-labelledby="clubs-title">
          <div className="card-head">
            <h2 className="card-title" id="clubs-title">
              Club groups
            </h2>
            <span className="meta">{clubs.length}</span>
          </div>
          {clubs.length === 0 ? (
            <p className="meta card-pad">No clubs yet. Create the first one: it takes a minute.</p>
          ) : (
            <div className="list">
              {clubs.map((club) => {
                const term = club.term?.json as Term | undefined;
                const weeks = term?.weeks ?? 12;
                const run = new Set(club.sessions.map((s) => s.week).filter(Boolean));
                const live = club.sessions.some((s) => !sessionIsOver(s));
                let next: number | null = null;
                for (let w = 1; w <= weeks; w++) if (!run.has(w)) { next = w; break; }
                const nextDate = next ? weekDate(school?.term_start, club.meets_day, next) : null;
                const meets = meetsLabel(club.meets_day, club.meets_time);
                const kids = kidsPerClub.get(club.id) ?? 0;
                const manager = club.teacher_id === userId ? "You" : nameOf(club.teacher_id);
                return (
                  <div key={club.id} className="item-row" style={{ alignItems: "flex-start" }}>
                    <div className="grow">
                      <b>
                        <Link href={`/teacher/class/${club.id}`}>{club.name}</Link>
                      </b>
                      <span className="meta">
                        {isTrack(club.track) ? TRACK_LABEL[club.track] : ""}
                        {meets ? ` · ${meets}` : ""} · {kids} {kids === 1 ? "child" : "children"}
                      </span>
                      <span className="meta">
                        Run by {manager}
                        {pending.has(club.teacher_id) ? " (invite not accepted yet)" : ""}
                      </span>
                      <span className="meta">
                        {run.size} of {weeks} weeks run
                        {next ? ` · next: week ${next}${nextDate ? `, ${shortDay(nextDate)}` : ""}` : " · term complete"}
                      </span>
                    </div>
                    {live ? <span className="chip chip-live">Live</span> : null}
                    <Link className="btn" href={`/teacher/class/${club.id}`}>
                      Open
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <form action={createClub} className="card card-pad stack" id="new-club">
          <h2 className="card-title">New club group</h2>
          {params.club_error && (
            <div className="notice notice-error">
              <span>{params.club_error}</span>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="club_name">
              Club name
            </label>
            <input className="input" id="club_name" name="name" required maxLength={60} placeholder="e.g. Comic Club, Tuesday group" />
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
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="meets_day">
                Meets on
              </label>
              <select className="input" id="meets_day" name="meets_day" defaultValue="">
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
              <input className="input" id="meets_time" name="meets_time" type="time" step={300} />
            </div>
          </div>
          <ManagerPicker colleagues={colleagues} />
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={terms.length === 0}>
              Create club
            </button>
            <span className="meta">You get the club code straight away.</span>
          </div>
        </form>
      </div>

      <section className="section" id="parents">
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">For parents</h2>
            <span className="meta">A description for your activities sign-up list</span>
          </div>
          {clubs.length === 0 ? (
            <p className="meta card-pad">Once you create a club, its description for parents appears here, ready to copy.</p>
          ) : (
            <div className="list">
              {clubs.map((club) => {
                const term = club.term?.json as Term | undefined;
                return (
                  <div key={club.id} className="card-pad stack" style={{ gap: 8 }}>
                    <b>{club.name}</b>
                    <CopyText
                      text={parentClubDescription({
                        clubName: club.name,
                        schoolName: school?.name ?? "your school",
                        track: isTrack(club.track) ? club.track : "8-9",
                        termTitle: term?.title ?? club.term?.title ?? "Term 1",
                        termWeeks: term?.weeks ?? 12,
                        managerName: club.teacher_id ? peopleById.get(club.teacher_id)?.display_name ?? null : null,
                        meetsDay: club.meets_day,
                        meetsTime: club.meets_time,
                        termStart: school?.term_start ?? null,
                      })}
                      label="Copy description"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-two" style={{ alignItems: "start" }} id="people">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Teachers and admins</h2>
            <span className="meta">{people.length}</span>
          </div>
          <div className="list">
            {people.map((person) => {
              const runs = clubs.filter((c) => c.teacher_id === person.id).map((c) => c.name);
              return (
                <div key={person.id} className="item-row">
                  <div className="grow">
                    <b>
                      {person.display_name ?? person.email}
                      {person.id === userId ? " (you)" : ""}
                    </b>
                    <span className="meta">
                      {person.email}
                      {runs.length ? ` · runs ${runs.join(", ")}` : ""}
                    </span>
                  </div>
                  {pending.has(person.id) && (
                    <form action={resendColleagueInvite}>
                      <input type="hidden" name="profile_id" value={person.id} />
                      <button className="btn" type="submit" style={{ minHeight: 32 }}>
                        Resend invite
                      </button>
                    </form>
                  )}
                  <span className={`chip${pending.has(person.id) ? "" : person.role === "admin" ? " chip-petrol" : ""}`}>
                    {pending.has(person.id) ? "Invited" : person.role === "admin" ? "School admin" : "Teacher"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <form action={inviteTeacher} className="card card-pad stack">
          <h2 className="card-title">Invite a colleague</h2>
          <p className="meta">To run a club, choose them when you create the club instead. Use this for another school admin, or a teacher who will run a club later.</p>
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
                    <b>{weekLabel(session.week, session.title ?? undefined)}</b>
                    <span className="meta">
                      {session.class?.name ?? "Club"} · {session.class?.teacher?.display_name ?? "Teacher"} · {formatDateTime(session.started_at)}
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
