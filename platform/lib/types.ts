import type { Mission, TeacherInputs } from "./missions";

export type ProfileRole = "admin" | "teacher";

export type School = {
  id: string;
  name: string;
  country: string | null;
  daily_image_cap: number;
  created_at: string;
};

export type Profile = {
  id: string;
  school_id: string | null;
  role: ProfileRole;
  display_name: string | null;
  email: string | null;
  is_superadmin: boolean;
  created_at: string;
};

export type ClassRow = {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  year_group: number;
  code: string;
  created_at: string;
};

export type MissionRow = {
  id: string;
  number: number;
  type: Mission["type"];
  json: Mission;
  version: number;
  published: boolean;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  class_id: string;
  mission_id: string;
  mission_version: number;
  mission_snapshot: Mission;
  teacher_inputs: TeacherInputs;
  public_id: string;
  started_at: string;
  ended_at: string | null;
};

export type Participant = {
  id: string;
  session_id: string;
  display_name: string;
  kid_rules: string | null;
  joined_at: string;
  message_count: number;
  image_count: number;
};

export type MessageRole = "user" | "assistant" | "system";
export type MessageKind = "text" | "image";

export type Moderation = {
  ok: boolean;
  reason?: string;
  stage: "input" | "output" | "image";
};

export type MessageRow = {
  id: string;
  participant_id: string;
  parent_id: string | null;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  image_path: string | null;
  moderation: Moderation | null;
  created_at: string;
};

export type Pin = {
  id: string;
  participant_id: string;
  message_id: string;
  position: number;
  created_at: string;
};

/** What the kid client receives for one message. */
export type PlayMessage = {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  imageUrl: string | null;
  blocked: boolean;
  parentId: string | null;
  createdAt: string;
};

export type PlayState = {
  participant: { id: string; displayName: string };
  mission: import("./missions").KidMission;
  kidRules: string;
  messages: PlayMessage[];
  pins: { id: string; messageId: string; position: number }[];
  remaining: { messages: number; images: number };
  ended: boolean;
  galleryUrl: string;
};
