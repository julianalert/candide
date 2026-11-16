import Image from "next/image";
import Link from "next/link";
import { TeacherTabs } from "@/components/teacher-tabs";
import { UserMenu } from "@/components/user-menu";
import { getTeacher, isAdminProfile } from "@/lib/teacher";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, email } = await getTeacher();
  const isAdmin = isAdminProfile(profile);
  const { data: school } = profile?.school_id
    ? await supabase.from("schools").select("name").eq("id", profile.school_id).maybeSingle<{ name: string }>()
    : { data: null };
  const roleLabel = profile?.job_title || (isAdmin ? "School admin" : "Teacher");

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
          <UserMenu name={profile?.display_name ?? ""} email={email} roleLabel={roleLabel} schoolName={school?.name ?? null} isAdmin={isAdmin} />
        </div>
      </header>
      {children}
    </>
  );
}
