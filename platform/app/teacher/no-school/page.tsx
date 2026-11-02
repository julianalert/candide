import { getTeacher } from "@/lib/teacher";

export default async function NoSchoolPage() {
  const { email } = await getTeacher();
  return (
    <main className="page">
      <div className="card card-pad join-card stack">
        <h1 className="card-title">Your account isn&rsquo;t attached to a school yet</h1>
        <p className="meta">
          You signed in as <b>{email}</b>, but no school has invited this address. Ask your school admin to invite you from their School tab, then sign in again
          with the link they send.
        </p>
      </div>
    </main>
  );
}
