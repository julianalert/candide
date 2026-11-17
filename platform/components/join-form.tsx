"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Name = { id: string; name: string };
type ListResponse = { error?: string; week?: number | null; title?: string; names?: Name[] };

// Step 1: the club code. Step 2: tap your name on the club list.
export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [list, setList] = useState<{ week: number | null; title: string; names: Name[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function post(body: Record<string, string>) {
    const res = await fetch("/api/play/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, json: (await res.json()) as ListResponse };
  }

  async function findClub(event: React.FormEvent) {
    event.preventDefault();
    setBusy("code");
    setError(null);
    try {
      const { ok, json } = await post({ code });
      if (!ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }
      setList({ week: json.week ?? null, title: json.title ?? "", names: json.names ?? [] });
    } catch {
      setError("We couldn't reach the server. Check the wifi and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function pick(kidId: string) {
    setBusy(kidId);
    setError(null);
    try {
      const { ok, json } = await post({ code, kidId });
      if (!ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/play");
    } catch {
      setError("We couldn't reach the server. Check the wifi and try again.");
    } finally {
      setBusy(null);
    }
  }

  const notice = error && (
    <div className="notice notice-warn" role="alert" style={{ fontSize: 16 }}>
      <span>{error}</span>
    </div>
  );

  if (list) {
    return (
      <div className="stack card-pad" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 4 }}>
          {list.week ? <span className="section-label">Week {list.week}</span> : null}
          <h2 className="card-title" style={{ fontSize: 20 }}>
            {list.title}
          </h2>
          <p className="meta" style={{ fontSize: 16 }}>
            Tap your name.
          </p>
        </div>
        {list.names.length === 0 ? (
          <div className="notice notice-warn" style={{ fontSize: 16 }}>
            <span>Your group&rsquo;s list is empty. Ask your teacher to add your name.</span>
          </div>
        ) : (
          <div className="name-grid" role="list">
            {list.names.map((n) => (
              <button key={n.id} role="listitem" type="button" className="btn btn-big name-btn" disabled={busy !== null} onClick={() => pick(n.id)}>
                {busy === n.id ? "Joining…" : n.name}
              </button>
            ))}
          </div>
        )}
        {notice}
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <button type="button" className="btn" onClick={() => setList(null)}>
            ← Different code
          </button>
          <span className="caption">Not on the list? Ask your teacher.</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={findClub} className="stack card-pad" style={{ gap: 18 }}>
      <div className="field">
        <label className="label" htmlFor="code" style={{ fontSize: 16 }}>
          Group code
        </label>
        <input
          className="input input-big input-code"
          id="code"
          name="code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          required
        />
      </div>
      {notice}
      <button className="btn btn-primary btn-big" type="submit" disabled={busy !== null || code.length < 6}>
        {busy ? "Looking…" : "Find my group"}
      </button>
      <p className="caption">No account, no email. Your teacher has the code.</p>
    </form>
  );
}
