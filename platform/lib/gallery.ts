import { signImagePaths } from "./play";
import { createServiceSupabase } from "./supabase/service";
import type { MessageRow, Participant, Pin, SessionRow } from "./types";

export type GalleryItem = {
  id: string;
  kind: "text" | "image";
  content: string;
  imageUrl: string | null;
  pinnedAt: string;
};

export type GalleryGroup = { participantId: string; name: string; items: GalleryItem[] };

export type GalleryData = {
  session: { id: string; publicId: string; startedAt: string; endedAt: string | null };
  mission: { title: string; number: number; idea: string };
  className: string;
  schoolName: string;
  groups: GalleryGroup[];
};

type SessionWithClass = SessionRow & { class: { name: string; school: { name: string } | null } | null };

export async function loadGalleryBySessionId(sessionId: string): Promise<GalleryData | null> {
  return loadGallery("id", sessionId);
}

export async function loadGalleryByPublicId(publicId: string): Promise<GalleryData | null> {
  return loadGallery("public_id", publicId);
}

async function loadGallery(column: "id" | "public_id", value: string): Promise<GalleryData | null> {
  const db = createServiceSupabase();
  const { data: session } = await db
    .from("sessions")
    .select("*, class:classes(name, school:schools(name))")
    .eq(column, value)
    .maybeSingle<SessionWithClass>();
  if (!session) return null;

  const { data: participantRows } = await db.from("participants").select("*").eq("session_id", session.id).order("display_name");
  const participants = (participantRows ?? []) as Participant[];
  const participantIds = participants.map((p) => p.id);

  let pins: Pin[] = [];
  let messages = new Map<string, MessageRow>();
  if (participantIds.length) {
    const { data: pinRows } = await db.from("pins").select("*").in("participant_id", participantIds).order("position");
    pins = (pinRows ?? []) as Pin[];
    if (pins.length) {
      const { data: messageRows } = await db.from("messages").select("*").in("id", pins.map((p) => p.message_id));
      messages = new Map(((messageRows ?? []) as MessageRow[]).map((m) => [m.id, m]));
    }
  }
  const urls = await signImagePaths([...messages.values()].map((m) => m.image_path ?? "").filter(Boolean));

  const groups: GalleryGroup[] = participants
    .map((participant) => ({
      participantId: participant.id,
      name: participant.display_name,
      items: pins
        .filter((pin) => pin.participant_id === participant.id)
        .map((pin) => {
          const message = messages.get(pin.message_id);
          if (!message) return null;
          return {
            id: message.id,
            kind: message.kind,
            content: message.content,
            imageUrl: message.image_path ? urls.get(message.image_path) ?? null : null,
            pinnedAt: pin.created_at,
          } satisfies GalleryItem;
        })
        .filter((item): item is GalleryItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);

  const mission = session.mission_snapshot;
  return {
    session: { id: session.id, publicId: session.public_id, startedAt: session.started_at, endedAt: session.ended_at },
    mission: { title: mission.title, number: mission.number, idea: mission.idea },
    className: session.class?.name ?? "",
    schoolName: session.class?.school?.name ?? "",
    groups,
  };
}
