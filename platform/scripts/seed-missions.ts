import "./_env";
import { createClient } from "@supabase/supabase-js";
import { loadMissions } from "../lib/missions";
import type { MissionRow } from "../lib/types";

// Validates /missions/*.json and upserts them into the missions table.
// A changed mission gets a new version; sessions keep their own snapshot.

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const missions = loadMissions();
  console.log(`Validated ${missions.length} missions.`);

  const { data: existingRows, error } = await db.from("missions").select("id, number, type, json, version, published, updated_at");
  if (error) throw error;
  const existing = new Map((existingRows as MissionRow[] | null)?.map((row) => [row.id, row]) ?? []);

  for (const mission of missions) {
    const current = existing.get(mission.id);
    const changed = !current || JSON.stringify(current.json) !== JSON.stringify(mission);
    if (!changed) {
      console.log(`  = ${mission.number.toString().padStart(2, "0")} ${mission.title} (v${current!.version}, unchanged)`);
      continue;
    }
    const version = current ? current.version + 1 : 1;
    const { error: upsertError } = await db.from("missions").upsert(
      {
        id: mission.id,
        number: mission.number,
        type: mission.type,
        json: mission,
        version,
        published: current?.published ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (upsertError) throw upsertError;
    console.log(`  ${current ? "↑" : "+"} ${mission.number.toString().padStart(2, "0")} ${mission.title} (v${version})`);
  }

  const orphaned = [...existing.keys()].filter((id) => !missions.some((m) => m.id === id));
  if (orphaned.length) console.log(`Not in the repo any more (left in place, consider unpublishing): ${orphaned.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
