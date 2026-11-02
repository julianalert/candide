import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { Workspace } from "@/components/workspace/workspace";
import type { GalleryData } from "@/lib/gallery";
import { kidView, loadMissions } from "@/lib/missions";
import type { PlayState } from "@/lib/types";

// Design preview with fixture data, development only. Lets you look at the kid workspace
// and the gallery without a database. /dev/preview?screen=workspace|gallery&mission=6
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string; mission?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const missions = loadMissions();
  const mission = missions.find((m) => m.number === Number(params.mission ?? 2)) ?? missions[1];
  const now = new Date().toISOString();

  if (params.screen === "gallery") {
    const data: GalleryData = {
      session: { id: "s1", publicId: "ABCDEFGHJKLM", startedAt: now, endedAt: now },
      mission: { title: mission.title, number: mission.number, idea: mission.idea },
      className: "5B",
      schoolName: "Pilot School",
      groups: [
        {
          participantId: "p1",
          name: "Sam",
          items: [
            { id: "m1", kind: "text", content: "The Glowfrog lives in misty swamps and eats fireflies. Its superpower is a light so bright it can guide lost boats home. Its weakness: it falls asleep the moment it gets dark.", imageUrl: null, pinnedAt: now },
            { id: "m2", kind: "image", content: "a green frog with glowing spots", imageUrl: "/dev-placeholder.svg", pinnedAt: now },
          ],
        },
        {
          participantId: "p2",
          name: "Zoë",
          items: [{ id: "m3", kind: "image", content: "a purple six-legged cat on the moon", imageUrl: "/dev-placeholder.svg", pinnedAt: now }],
        },
      ],
    };
    return (
      <main className="page">
        <Gallery data={data} publicUrl="https://app.candideai.com/g/ABCDEFGHJKLM" mode="teacher" />
      </main>
    );
  }

  const state: PlayState = {
    participant: { id: "preview", displayName: "Sam" },
    mission: kidView(mission, { topic: "the water cycle" }),
    kidRules: mission.ai.features.includes("rulesBox") ? "1. Always answer in rhymes.\n2. Never say the word yes." : "",
    messages: [
      { id: "u1", role: "user", kind: "text", content: "My creature is a frog with wings called Zib. It lives in the clouds.", imageUrl: null, blocked: false, parentId: null, createdAt: now },
      { id: "a1", role: "assistant", kind: "text", content: "Zib sounds wonderful. A frog in the clouds is a great start. What does Zib eat up there, and what is one thing Zib is brilliant at?", imageUrl: null, blocked: false, parentId: null, createdAt: now },
      { id: "u2", role: "user", kind: "text", content: "What is my teacher's phone number?", imageUrl: null, blocked: true, parentId: null, createdAt: now },
      { id: "u3", role: "user", kind: "image", content: "a green frog with butterfly wings sitting on a cloud", imageUrl: null, blocked: false, parentId: null, createdAt: now },
      { id: "a2", role: "assistant", kind: "image", content: "a green frog with butterfly wings sitting on a fluffy cloud, friendly digital illustration", imageUrl: "/dev-placeholder.svg", blocked: false, parentId: "u3", createdAt: now },
    ],
    pins: [{ id: "pin1", messageId: "a1", position: 1 }],
    remaining: { messages: 0.85, images: 0.75 },
    ended: false,
    galleryUrl: "https://app.candideai.com/g/ABCDEFGHJKLM",
  };
  return <Workspace initial={state} />;
}
