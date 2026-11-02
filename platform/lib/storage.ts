import type { SupabaseClient } from "@supabase/supabase-js";
import { IMAGE_BUCKET } from "./play";

/** Remove every generated image under creations/{sessionId}/. Called after a session is deleted. */
export async function removeSessionImages(db: SupabaseClient, sessionId: string): Promise<number> {
  const bucket = db.storage.from(IMAGE_BUCKET);
  const { data: folders } = await bucket.list(sessionId, { limit: 1000 });
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${sessionId}/${folder.name}`, { limit: 1000 });
    for (const file of files ?? []) paths.push(`${sessionId}/${folder.name}/${file.name}`);
  }
  if (paths.length) await bucket.remove(paths);
  return paths.length;
}
