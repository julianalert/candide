import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { getParticipant } from "@/lib/play";
import { buildPlayState } from "@/lib/play-state";

export const metadata = { title: "Your mission" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const ctx = await getParticipant();
  if (!ctx) redirect("/join");
  const state = await buildPlayState(ctx);
  return <Workspace initial={state} />;
}
