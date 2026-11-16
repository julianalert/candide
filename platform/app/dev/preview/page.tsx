import Image from "next/image";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { TeacherTabs } from "@/components/teacher-tabs";
import { UserMenu } from "@/components/user-menu";
import { WelcomeForm } from "@/components/welcome-form";
import { Workspace } from "@/components/workspace/workspace";
import type { GalleryData } from "@/lib/gallery";
import { isTrack, kidView, loadTerms } from "@/lib/missions";
import type { PlayState } from "@/lib/types";

// Design preview with fixture data, development only. Lets you look at the kid workspace
// the gallery and the admin welcome screen without a database.
// /dev/preview?screen=workspace|gallery|welcome&week=4&track=10-11
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string; week?: string; track?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const [{ term, missions }] = loadTerms();
  const mission = missions.find((m) => m.week === Number(params.week ?? 4)) ?? missions[3];
  const track = isTrack(params.track) ? params.track : "8-9";
  const now = new Date().toISOString();

  if (params.screen === "welcome") {
    return (
      <>
        <header className="topbar">
          <div className="brand">
            <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} priority />
          </div>
          <TeacherTabs isAdmin />
          <div className="topbar-actions">
            <UserMenu name="Julien" email="julien@example.com" roleLabel="Principal or Head of School" schoolName="Hiboulala" isAdmin />
          </div>
        </header>
        <WelcomeForm school={{ name: "Hiboulala", city: "Paris", country: "FR", term_start: null }} displayName="Julien" jobTitle={null} email="julien@example.com" editing={false} />
      </>
    );
  }

  if (params.screen === "gallery") {
    const data: GalleryData = {
      session: { id: "s1", publicId: "ABCDEFGHJKLM", startedAt: now, endedAt: now },
      mission: { title: mission.title, week: mission.week, skill: mission.skill },
      className: "Comic Club",
      schoolName: "Pilot School",
      groups: [
        {
          participantId: "p1",
          name: "Sam",
          items: [
            { id: "m1", kind: "text", content: "Ember. Sidekick. A dragon made of autumn leaves who hides in trees. Superpower: turns into a whirlwind. Weakness: rain.", imageUrl: null, pinnedAt: now },
            { id: "m2", kind: "image", content: "a kind dragon made of orange autumn leaves curled around an old tree", imageUrl: "/dev-placeholder.svg", pinnedAt: now },
          ],
        },
        {
          participantId: "p2",
          name: "Zoë",
          items: [{ id: "m3", kind: "image", content: "a purple cat hero bouncing on the moon", imageUrl: "/dev-placeholder.svg", pinnedAt: now }],
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
    mission: kidView(mission, track),
    termTitle: term.title,
    earlier: [
      { pinId: "e1", messageId: "em1", week: 2, title: "Design your hero", kind: "text", content: "Rafi the Fox. Looks: small, orange, red cape. Personality: kind and curious. Superpower: hears trouble from a mile away. Weakness: scared of heights.", imageUrl: null },
      { pinId: "e2", messageId: "em2", week: 2, title: "Design your hero", kind: "image", content: "a small brave fox in a red cape on a rope bridge, cartoon style", imageUrl: "/dev-placeholder.svg" },
      { pinId: "e3", messageId: "em3", week: 3, title: "Lock your hero", kind: "text", content: "Master description: Rafi is a small orange fox with a white-tipped tail, a red cape and green boots, drawn in a bright cartoon style.", imageUrl: null },
    ],
    kidRules: "",
    messages: [
      { id: "u1", role: "user", kind: "text", content: "Can you give me five sidekick ideas for Rafi?", imageUrl: null, blocked: false, parentId: null, createdAt: now },
      { id: "a1", role: "assistant", kind: "text", content: "Here are five ideas. Which one feels right, or do you want to mix two?\n1. A tree dragon made of leaves\n2. A tiny owl who reads maps\n3. A robot snail with a jet shell\n4. A desert hedgehog who digs tunnels\n5. A cloud puppy who carries Rafi over bridges", imageUrl: null, blocked: false, parentId: null, createdAt: now },
      { id: "u2", role: "user", kind: "text", content: "Make me Spider-Man", imageUrl: null, blocked: true, parentId: null, createdAt: now },
      { id: "u3", role: "user", kind: "image", content: "a kind dragon made of orange autumn leaves curled around an old tree, cartoon style", imageUrl: null, blocked: false, parentId: null, createdAt: now },
      { id: "a2", role: "assistant", kind: "image", content: "a kind dragon made of orange autumn leaves curled around an old tree, friendly digital illustration", imageUrl: "/dev-placeholder.svg", blocked: false, parentId: "u3", createdAt: now },
    ],
    pins: [{ id: "pin1", messageId: "a2", position: 1 }],
    remaining: { messages: 0.85, images: 0.75 },
    ended: false,
    galleryUrl: "https://app.candideai.com/g/ABCDEFGHJKLM",
  };
  return <Workspace initial={state} />;
}
