import "./_env";
import { createClient } from "@supabase/supabase-js";
import { loadTerms } from "../lib/missions";
import type { MissionRow, TermRow } from "../lib/types";

// Validates /terms/<term>/*.json and upserts the terms and their weekly missions.
// A changed mission gets a new version; sessions keep their own snapshot.
// Missions that are no longer in the repo are unpublished, never deleted (old galleries use them).

/** JSON with sorted keys: Postgres jsonb reorders keys, so plain JSON.stringify always differs. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const bundles = loadTerms();
  console.log(`Validated ${bundles.length} term(s), ${bundles.reduce((n, b) => n + b.missions.length, 0)} missions.`);

  const { data: termRows, error: termError } = await db.from("terms").select("*");
  if (termError) throw termError;
  const existingTerms = new Map(((termRows ?? []) as TermRow[]).map((row) => [row.id, row]));

  const { data: missionRows, error: missionError } = await db.from("missions").select("id, term_id, week, json, version, published, updated_at");
  if (missionError) throw missionError;
  const existingMissions = new Map(((missionRows ?? []) as MissionRow[]).map((row) => [row.id, row]));

  for (const { term, missions } of bundles) {
    const current = existingTerms.get(term.id);
    if (!current || stable(current.json) !== stable(term) || current.title !== term.title || current.number !== term.number) {
      const version = current && Object.keys(current.json ?? {}).length ? current.version + 1 : 1;
      const { error } = await db
        .from("terms")
        .upsert({ id: term.id, number: term.number, title: term.title, json: term, version, published: current?.published ?? true, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
      console.log(`${current ? "↑" : "+"} Term ${term.number} · ${term.title} (v${version})`);
    } else {
      console.log(`= Term ${term.number} · ${term.title} (v${current.version}, unchanged)`);
    }

    for (const mission of missions) {
      const row = existingMissions.get(mission.id);
      const label = `  week ${String(mission.week).padStart(2, "0")} ${mission.title}`;
      if (row && stable(row.json) === stable(mission) && row.published) {
        console.log(`${label} (v${row.version}, unchanged)`);
        continue;
      }
      const version = row ? row.version + 1 : 1;
      const { error } = await db.from("missions").upsert(
        {
          id: mission.id,
          term_id: term.id,
          week: mission.week,
          number: null,
          type: null,
          json: mission,
          version,
          published: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      console.log(`${label} (${row ? "↑" : "+"} v${version})`);
    }
  }

  const keep = new Set(bundles.flatMap((b) => b.missions.map((m) => m.id)));
  const stale = [...existingMissions.values()].filter((row) => row.published && !keep.has(row.id)).map((row) => row.id);
  if (stale.length) {
    const { error } = await db.from("missions").update({ published: false }).in("id", stale);
    if (error) throw error;
    console.log(`Unpublished missions no longer in the repo: ${stale.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
