"use client";

import { useState } from "react";

type Colleague = { id: string; name: string; pending: boolean };

/**
 * "Who runs this club?": the admin themselves, a colleague already in the school,
 * or a new teacher invited by email. Posts `manager` = "me" | "invite" | profile id,
 * plus `manager_name` and `manager_email` when inviting.
 */
export function ManagerPicker({ colleagues, defaultValue = "me", meLabel = "I’ll run it myself" }: { colleagues: Colleague[]; defaultValue?: string; meLabel?: string }) {
  const [choice, setChoice] = useState(defaultValue);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="field">
        <label className="label" htmlFor="manager">
          Who runs this group?
        </label>
        <select className="input" id="manager" name="manager" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="me">{meLabel}</option>
          {colleagues.length > 0 && (
            <optgroup label="A colleague">
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.pending ? " (invited)" : ""}
                </option>
              ))}
            </optgroup>
          )}
          <option value="invite">Invite a teacher to run it…</option>
        </select>
      </div>
      {choice === "invite" && (
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="manager_name">
              Teacher&rsquo;s name
            </label>
            <input className="input" id="manager_name" name="manager_name" maxLength={60} placeholder="Ms Khan" required />
          </div>
          <div className="field">
            <label className="label" htmlFor="manager_email">
              Their school email
            </label>
            <input className="input" id="manager_email" name="manager_email" type="email" maxLength={200} placeholder="teacher@school.edu" required />
          </div>
        </div>
      )}
      {choice === "invite" && <p className="caption">They get an email to join Candide. When they sign in, they land straight on this group.</p>}
    </div>
  );
}
