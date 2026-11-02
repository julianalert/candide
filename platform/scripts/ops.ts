import "./_env";
import { createClient } from "@supabase/supabase-js";

// Operational jobs with no UI:
//   npm run ops end-stale            close sessions older than three hours
//   npm run ops purge-transcripts    delete unpinned messages older than 90 days
//   npm run ops moderation-report    blocked messages per school for the last 7 days (--days N)

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const command = process.argv[2];

  switch (command) {
    case "end-stale": {
      const { data, error } = await db.rpc("end_stale_sessions");
      if (error) throw error;
      console.log(`Ended ${data} stale session(s).`);
      break;
    }
    case "purge-transcripts": {
      const { data, error } = await db.rpc("purge_old_transcripts");
      if (error) throw error;
      console.log(`Deleted ${data} message(s) older than 90 days.`);
      break;
    }
    case "moderation-report": {
      const daysIndex = process.argv.indexOf("--days");
      const days = daysIndex === -1 ? 7 : Number(process.argv[daysIndex + 1]);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db.rpc("moderation_report", { p_since: since });
      if (error) throw error;
      const rows = (data ?? []) as { school_name: string; stage: string; reason: string; count: number }[];
      if (!rows.length) {
        console.log(`No blocked messages in the last ${days} day(s).`);
        break;
      }
      console.log(`Blocked messages since ${since.slice(0, 10)}:`);
      for (const row of rows) console.log(`  ${row.school_name.padEnd(30)} ${row.stage.padEnd(7)} ${row.reason.padEnd(16)} ${row.count}`);
      break;
    }
    default:
      console.error("Usage: npm run ops <end-stale|purge-transcripts|moderation-report [--days N]>");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
