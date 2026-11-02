"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { PlayMessage, PlayState } from "@/lib/types";
import { ApiError, fetchState, postJson, streamMessage } from "./api";
import { Board } from "./board";
import { MissionPanel } from "./mission-panel";
import { PENDING_IMAGE_ID, STREAMING_ID, Studio } from "./studio";

type Panel = "mission" | "studio" | "board";
type Pin = PlayState["pins"][number];

// The kid workspace: mission panel, studio, creation board. Three columns on a
// Chromebook, tabs under 900px. State lives here; the panels are presentational.

export function Workspace({ initial }: { initial: PlayState }) {
  const router = useRouter();
  const [messages, setMessages] = useState<PlayMessage[]>(initial.messages);
  const [pins, setPins] = useState<Pin[]>(initial.pins);
  const [remaining, setRemaining] = useState(initial.remaining);
  const [ended, setEnded] = useState(initial.ended);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("studio");

  const pinnedMessageIds = useMemo(() => new Set(pins.map((p) => p.messageId)), [pins]);

  const refresh = useCallback(async () => {
    try {
      const state = await fetchState();
      setRemaining(state.remaining);
      setEnded(state.ended);
      setPins(state.pins);
    } catch (error) {
      if (error instanceof ApiError && error.code === "no_session") router.push("/join");
    }
  }, [router]);

  function handleError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.code === "ended") {
        setEnded(true);
        return;
      }
      if (error.code === "no_session") {
        router.push("/join");
        return;
      }
      setNotice(error.message);
      return;
    }
    setNotice("Something went wrong. Try again.");
  }

  function tempMessage(partial: Partial<PlayMessage> & { id: string; role: PlayMessage["role"] }): PlayMessage {
    return { kind: "text", content: "", imageUrl: null, blocked: false, parentId: null, createdAt: new Date().toISOString(), ...partial };
  }

  async function sendText(text: string) {
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, tempMessage({ id: tempId, role: "user", content: text }), tempMessage({ id: STREAMING_ID, role: "assistant" })]);
    setBusy(true);
    try {
      for await (const event of streamMessage(text)) {
        switch (event.type) {
          case "start":
            setMessages((prev) => prev.map((m) => (m.id === tempId ? event.userMessage : m)));
            break;
          case "blocked":
            setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID).map((m) => (m.id === tempId ? { ...m, blocked: true } : m)));
            break;
          case "delta":
            setMessages((prev) => prev.map((m) => (m.id === STREAMING_ID ? { ...m, content: m.content + event.text } : m)));
            break;
          case "done":
            setMessages((prev) => prev.map((m) => (m.id === STREAMING_ID ? event.message : m)));
            break;
          case "error":
            setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID));
            setNotice(event.message);
            break;
        }
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== STREAMING_ID && m.id !== tempId));
      handleError(error);
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  type ImageResponse = {
    blocked?: boolean;
    message?: PlayMessage | string;
    userMessage?: PlayMessage;
    remaining?: { messages: number; images: number };
  };

  async function makeImage(text: string | null, retryOf: string | null) {
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      ...(text ? [tempMessage({ id: tempId, role: "user", kind: "image", content: text })] : []),
      tempMessage({ id: PENDING_IMAGE_ID, role: "assistant", kind: "image" }),
    ]);
    setBusy(true);
    try {
      const json = await postJson<ImageResponse>("/api/play/image", retryOf ? { retryOf } : { text });
      if (json.blocked) {
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== PENDING_IMAGE_ID)
            .map((m) => (m.id === tempId ? (json.userMessage ?? { ...m, blocked: true }) : m)),
        );
        if (retryOf && typeof json.message === "string") setNotice(json.message);
        return;
      }
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === tempId && json.userMessage) return json.userMessage;
          if (m.id === PENDING_IMAGE_ID && json.message && typeof json.message !== "string") return json.message;
          return m;
        }),
      );
      if (json.remaining) setRemaining(json.remaining);
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== PENDING_IMAGE_ID && m.id !== tempId));
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function pin(messageId: string) {
    try {
      const { pin } = await postJson<{ pin: Pin }>("/api/play/pin", { messageId });
      setPins((prev) => (prev.some((p) => p.messageId === pin.messageId) ? prev : [...prev, pin]));
    } catch (error) {
      handleError(error);
    }
  }

  async function unpin(pinId: string) {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    try {
      await postJson("/api/play/pin", { pinId }, "DELETE");
    } catch (error) {
      handleError(error);
      void refresh();
    }
  }

  async function saveRules(rules: string) {
    try {
      await postJson("/api/play/rules", { rules });
    } catch (error) {
      handleError(error);
      throw error;
    }
  }

  const mission = initial.mission;

  return (
    <div className="kid-shell">
      <header className="kid-topbar">
        <div className="actions" style={{ gap: 14 }}>
          <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} priority />
          <span className="meta" style={{ fontSize: 15 }}>
            Mission {String(mission.number).padStart(2, "0")} · {mission.title}
          </span>
        </div>
        <span className="kicker" style={{ fontSize: 15, padding: "4px 12px" }} aria-label={`Your badge name is ${initial.participant.displayName}`}>
          {initial.participant.displayName}
        </span>
      </header>

      <main className="ws">
        <section className={`card ws-panel${panel === "mission" ? " is-active" : ""}`} aria-label="Mission">
          <MissionPanel mission={mission} participantId={initial.participant.id} kidRules={initial.kidRules} ended={ended} onSaveRules={saveRules} />
        </section>
        <section className={`card ws-panel${panel === "studio" ? " is-active" : ""}`} aria-label="Studio">
          <Studio
            mission={mission}
            displayName={initial.participant.displayName}
            messages={messages}
            pinnedMessageIds={pinnedMessageIds}
            remaining={remaining}
            ended={ended}
            busy={busy}
            notice={notice}
            galleryUrl={initial.galleryUrl}
            onSend={(text, picture) => (picture ? makeImage(text, null) : sendText(text))}
            onPin={pin}
            onRetry={(parentId) => makeImage(null, parentId)}
            onDismissNotice={() => setNotice(null)}
          />
        </section>
        <section className={`card ws-panel${panel === "board" ? " is-active" : ""}`} aria-label="My creation board">
          <Board pins={pins} messages={messages} ended={ended} onUnpin={unpin} />
        </section>
      </main>

      <nav className="ws-tabs" role="tablist" aria-label="Panels">
        {(
          [
            ["mission", "Mission"],
            ["studio", "Studio"],
            ["board", `Board${pins.length ? ` (${pins.length})` : ""}`],
          ] as [Panel, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" className="ws-tab" aria-selected={panel === key} onClick={() => setPanel(key)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
