"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/play/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const json = (await res.json()) as { error?: string; displayName?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/play");
    } catch {
      setError("We couldn't reach the server. Check the wifi and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack card-pad" style={{ gap: 18 }}>
      <div className="field">
        <label className="label" htmlFor="code" style={{ fontSize: 16 }}>
          Class code
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
      <div className="field">
        <label className="label" htmlFor="name" style={{ fontSize: 16 }}>
          Your first name
        </label>
        <input className="input input-big" id="name" name="name" autoComplete="off" maxLength={20} placeholder="Sam" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      {error && (
        <div className="notice notice-warn" role="alert" style={{ fontSize: 16 }}>
          <span>{error}</span>
        </div>
      )}
      <button className="btn btn-primary btn-big" type="submit" disabled={busy}>
        {busy ? "Joining…" : "Join my class"}
      </button>
      <p className="caption">Only your first name is saved, and only for this session.</p>
    </form>
  );
}
