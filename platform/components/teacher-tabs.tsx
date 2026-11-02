"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeacherTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const classesActive = pathname === "/teacher" || pathname.startsWith("/teacher/class") || pathname.startsWith("/teacher/session");
  return (
    <nav className="tabs" aria-label="Main">
      <Link className="tab" href="/teacher" aria-current={classesActive ? "page" : undefined}>
        Classes
      </Link>
      {isAdmin && (
        <Link className="tab" href="/teacher/school" aria-current={pathname.startsWith("/teacher/school") ? "page" : undefined}>
          School
        </Link>
      )}
    </nav>
  );
}
