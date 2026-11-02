import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { JoinForm } from "@/components/join-form";
import { KID_COOKIE, verifyKidSession } from "@/lib/kid-session";

export const metadata = { title: "Join your class" };
export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const token = (await cookies()).get(KID_COOKIE)?.value;
  const secret = process.env.KID_COOKIE_SECRET;
  const current = secret ? verifyKidSession(token, secret) : null;

  return (
    <div className="kid-shell">
      <header className="kid-topbar">
        <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} priority />
        <Link href="/login" className="meta">
          Teacher sign in →
        </Link>
      </header>
      <main className="page" style={{ paddingTop: 48 }}>
        <div className="card join-card">
          <div className="card-head">
            <h1 className="card-title" style={{ fontSize: 22 }}>
              Join your class
            </h1>
            <span className="meta">Your teacher has the code</span>
          </div>
          <JoinForm />
          {current && (
            <p className="meta" style={{ padding: "0 24px 20px" }}>
              Already joined? <Link href="/play">Back to your workspace →</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
