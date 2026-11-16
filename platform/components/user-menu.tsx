"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  email: string | null;
  roleLabel: string;
  schoolName: string | null;
  isAdmin: boolean;
};

export function initialsFor(name: string): string {
  const words = name.replace(/[^\p{L}\p{M}\s'-]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0].slice(0, 1) + words[words.length - 1].slice(0, 1);
  return letters.toUpperCase();
}

/** The signed-in adult: an avatar in the top bar that opens their account menu. */
export function UserMenu({ name, email, roleLabel, schoolName, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const initials = initialsFor(name || email || "?");

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="user-menu" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name || email}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <svg className="user-menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="user-dropdown" role="menu" aria-label="Account">
          <div className="user-dropdown-head">
            <span className="avatar avatar-lg" aria-hidden="true">
              {initials}
            </span>
            <div className="user-dropdown-who">
              <b>{name || email}</b>
              {email && name ? <span>{email}</span> : null}
              <span>{roleLabel}</span>
              {schoolName ? <span>{schoolName}</span> : null}
            </div>
          </div>
          <div className="user-dropdown-list">
            {isAdmin && (
              <Link role="menuitem" className="user-dropdown-item" href="/teacher/school" onClick={close}>
                School
              </Link>
            )}
            <Link role="menuitem" className="user-dropdown-item" href="/teacher/clubs" onClick={close}>
              My clubs
            </Link>
            {isAdmin && (
              <Link role="menuitem" className="user-dropdown-item" href="/teacher/welcome?edit=1" onClick={close}>
                School details
              </Link>
            )}
          </div>
          <form action="/auth/signout" method="post" className="user-dropdown-list">
            <button role="menuitem" type="submit" className="user-dropdown-item">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
