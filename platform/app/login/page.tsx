import Image from "next/image";
import Link from "next/link";
import { sendMagicLink } from "./actions";

export const metadata = { title: "Teacher sign in" };

type Search = { sent?: string; error?: string; email?: string; next?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <div className="kid-shell">
      <header className="kid-topbar">
        <Link href="/join" className="identity">
          <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} priority />
        </Link>
        <Link href="/join" className="meta">
          I&rsquo;m a student →
        </Link>
      </header>

      <main className="page">
        <div className="card join-card">
          <div className="card-head">
            <h1 className="card-title">Teacher sign in</h1>
            <span className="meta">No password · we email you a link</span>
          </div>

          {sent ? (
            <div className="stack card-pad">
              <div className="notice notice-good">
                <span>
                  Check your email. We sent a sign-in link to <b>{params.email}</b>. It works once and expires in an hour.
                </span>
              </div>
              <p className="meta">
                Nothing arrived? Check spam, or <Link href="/login">try again</Link>.
              </p>
            </div>
          ) : (
            <form action={sendMagicLink} className="stack card-pad">
              {params.error === "unknown" && (
                <div className="notice notice-warn">
                  <span>
                    <b>{params.email}</b> isn&rsquo;t on a school&rsquo;s teacher list yet. Ask your school admin to invite you.
                  </span>
                </div>
              )}
              {params.error === "failed" && (
                <div className="notice notice-error">
                  <span>We couldn&rsquo;t send the link. Please try again in a moment.</span>
                </div>
              )}
              {params.error === "link" && (
                <div className="notice notice-error">
                  <span>That link has expired or was already used. Request a new one.</span>
                </div>
              )}
              <div className="field">
                <label className="label" htmlFor="email">
                  School email
                </label>
                <input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={params.email ?? ""} placeholder="you@school.edu" />
              </div>
              <input type="hidden" name="next" value={params.next ?? "/teacher"} />
              <div className="actions">
                <button className="btn btn-primary" type="submit">
                  Email me a sign-in link
                </button>
                <span className="meta">Teachers are invited by their school admin.</span>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
