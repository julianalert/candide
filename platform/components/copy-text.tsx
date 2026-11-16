"use client";

import { useState } from "react";

/** A block of text with a Copy button, for things the school pastes elsewhere. */
export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this text", text);
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <pre className="prompt-box" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 15, lineHeight: 1.55 }}>
        {text}
      </pre>
      <div className="actions">
        <button className="btn" type="button" onClick={copy}>
          {copied ? "Copied" : label}
        </button>
      </div>
    </div>
  );
}
