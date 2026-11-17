"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Admins: School (every club, teachers, setup) and My clubs (the ones they run). Teachers: My clubs. */
export function TeacherTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const schoolActive = pathname.startsWith("/teacher/school") || pathname.startsWith("/teacher/welcome");
  const clubsActive = !schoolActive && (pathname.startsWith("/teacher/groups") || pathname.startsWith("/teacher/class") || pathname.startsWith("/teacher/session"));
  return (
    <nav className="tabs" aria-label="Main">
      {isAdmin && (
        <Link className="tab" href="/teacher/school" aria-current={schoolActive ? "page" : undefined}>
          School
        </Link>
      )}
      <Link className="tab" href="/teacher/groups" aria-current={clubsActive ? "page" : undefined}>
        My groups
      </Link>
    </nav>
  );
}
