"use client";

import { useTransition, type ReactNode } from "react";

/** A form whose submit asks for confirmation first. Used for ending and deleting sessions. */
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        if (!window.confirm(message)) return;
        startTransition(() => action(formData));
      }}
    >
      <fieldset disabled={pending} style={{ display: "contents" }}>
        {children}
      </fieldset>
    </form>
  );
}
