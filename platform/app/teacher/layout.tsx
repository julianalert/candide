import Image from "next/image";
import Link from "next/link";
import { TeacherTabs } from "@/components/teacher-tabs";
import { getTeacher } from "@/lib/teacher";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { profile, email } = await getTeacher();
  const isAdmin = profile?.role === "admin" || Boolean(profile?.is_superadmin);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Link className="identity" href="/teacher">
            <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} priority />
          </Link>
        </div>
        <TeacherTabs isAdmin={isAdmin} />
        <div className="topbar-actions">
          <span className="context">{profile?.display_name ?? email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
