"use client";

import { useEffect, useState } from "react";
import type { KidMission } from "@/lib/missions";

type Props = {
  mission: KidMission;
  participantId: string;
  kidRules: string;
  ended: boolean;
  onSaveRules: (rules: string) => Promise<void>;
};

export function MissionPanel({ mission, participantId, kidRules, ended, onSaveRules }: Props) {
  const storageKey = `candide:steps:${participantId}`;
  const [done, setDone] = useState<boolean[]>(() => mission.steps.map(() => false));
  const [rules, setRules] = useState(kidRules);
  const [savedRules, setSavedRules] = useState(kidRules);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as boolean[];
        if (Array.isArray(parsed) && parsed.length === mission.steps.length) setDone(parsed);
      }
    } catch {
      // ignore
    }
  }, [storageKey, mission.steps.length]);

  function toggle(index: number) {
    const next = done.map((value, i) => (i === index ? !value : value));
    setDone(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const current = done.findIndex((value) => !value);

  async function saveRules() {
    setSaving(true);
    try {
      await onSaveRules(rules);
      setSavedRules(rules);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="ws-panel-head">
        <span className="section-label">
          Mission {String(mission.number).padStart(2, "0")}
        </span>
        <span className="chip">{done.filter(Boolean).length}/{mission.steps.length} done</span>
      </div>
      <div className="ws-panel-body stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="card-title" style={{ fontSize: 22 }}>
            {mission.title}
          </h1>
          <p style={{ fontSize: 16, color: "var(--color-grey-700)" }}>{mission.intro}</p>
        </div>

        {mission.rulesBox && (
          <div className="stack" style={{ gap: 8 }}>
            <label className="label" htmlFor="rules" style={{ fontSize: 15 }}>
              Rules for your robot
            </label>
            <textarea
              id="rules"
              className="input"
              style={{ fontSize: 16, minHeight: 120 }}
              placeholder={"1. Always answer in rhymes.\n2. Never say the word yes.\n3. End every message with a joke."}
              value={rules}
              maxLength={600}
              disabled={ended}
              onChange={(e) => setRules(e.target.value)}
            />
            <div className="actions">
              <button className="btn btn-primary" type="button" onClick={saveRules} disabled={ended || saving || rules === savedRules}>
                {saving ? "Saving…" : rules === savedRules ? "Rules saved" : "Save rules"}
              </button>
              <span className="caption">Your robot follows these from its next reply.</span>
            </div>
          </div>
        )}

        <ol className="steps" aria-label="Build steps">
          {mission.steps.map((step, index) => (
            <li key={step} className={`step-item${done[index] ? " is-done" : ""}${index === current ? " is-current" : ""}`} onClick={() => toggle(index)}>
              <button
                type="button"
                className="step-check"
                aria-pressed={done[index]}
                aria-label={`Step ${index + 1}${done[index] ? ", done" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(index);
                }}
              >
                {done[index] ? "✓" : ""}
              </button>
              <span>{step}</span>
            </li>
          ))}
        </ol>

      </div>
    </>
  );
}
