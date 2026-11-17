import Link from "next/link";
import { TRACK_LABEL, isTrack } from "@/lib/missions";
import { meetsLabel } from "@/lib/schedule";
import { isAdminProfile, requireTeacher } from "@/lib/teacher";
import type { ClassRow } from "@/lib/types";

export const metadata = { title: "My groups" };

type ClubWithSessions = ClassRow & { sessions: { id: string; week: number | null }[]; term: { title: string; number: number } | null };

/** The clubs this person runs as manager. Admins see every club from the School page. */
export default async function MyClubsPage() {
  const { supabase, userId, profile } = await requireTeacher();
  const admin = isAdminProfile(profile);
  const { data } = await supabase
    .from("classes")
    .select("*, sessions(id, week), term:terms(title, number)")
    .eq("teacher_id", userId)
    .order("created_at", { ascending: false });
  const clubs = (data ?? []) as ClubWithSessions[];

  return (
    <main className="page">
      <div className="page-head">
        <div className="page-intro">
          <h1>My groups</h1>
          <p className="page-sub">The groups of children you run. Each one follows a term, one mission a week; children join with the group code and tap their name.</p>
        </div>
      </div>

      {clubs.length === 0 ? (
        <div className="card card-pad stack" style={{ maxWidth: 640 }}>
          <p>{admin ? "You don’t run a group yourself." : "You don’t run a group yet."}</p>
          <p className="meta">
            {admin ? (
              <>
                To run one, create it on the <Link href="/teacher/school">School page</Link> and choose &ldquo;I&rsquo;ll run it myself&rdquo;.
              </>
            ) : (
              "Your school admin creates the groups and chooses who runs each one. Once they assign you a group, it appears here."
            )}
          </p>
        </div>
      ) : (
        <div className="card list">
          {clubs.map((club) => {
            const weeksRun = new Set(club.sessions.map((s) => s.week).filter(Boolean)).size;
            const meets = meetsLabel(club.meets_day, club.meets_time);
            return (
              <Link key={club.id} href={`/teacher/class/${club.id}`} className="item-row" style={{ color: "inherit" }}>
                <div className="grow">
                  <b>{club.name}</b>
                  <span className="meta">
                    {club.term ? `Term ${club.term.number} · ${club.term.title}` : "Term"} · {isTrack(club.track) ? TRACK_LABEL[club.track] : ""}
                    {meets ? ` · ${meets}` : ""} · {weeksRun} week{weeksRun === 1 ? "" : "s"} run
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
    </main>
  );
}
