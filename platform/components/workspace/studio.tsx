"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KidMission } from "@/lib/missions";
import type { PlayMessage } from "@/lib/types";
import { useSpeech } from "./use-speech";

type Props = {
  mission: KidMission;
  displayName: string;
  messages: PlayMessage[];
  pinnedMessageIds: Set<string>;
  remaining: { messages: number; images: number };
  ended: boolean;
  busy: boolean;
  notice: string | null;
  galleryUrl: string;
  onSend: (text: string, picture: boolean) => Promise<void>;
  onPin: (messageId: string) => void;
  onRetry: (parentId: string) => void;
  onDismissNotice: () => void;
};

export const STREAMING_ID = "streaming";
export const PENDING_IMAGE_ID = "pending-image";

export function Studio({ mission, displayName, messages, pinnedMessageIds, remaining, ended, busy, notice, galleryUrl, onSend, onPin, onRetry, onDismissNotice }: Props) {
  const [text, setText] = useState("");
  const [picture, setPicture] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const appendSpeech = useCallback((spoken: string) => {
    setText((prev) => (prev ? `${prev} ${spoken}` : spoken));
    textareaRef.current?.focus();
  }, []);
  const speech = useSpeech(appendSpeech);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function submit() {
    const value = text.trim();
    if (!value || busy || ended) return;
    setText("");
    await onSend(value, picture && mission.imageEnabled);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const canPicture = mission.imageEnabled && remaining.images > 0;

  return (
    <>
      <div className="ws-panel-head">
        <span className="section-label">Studio</span>
        <span className="meta">Chat with your helper{mission.imageEnabled ? " or ask for a picture" : ""}</span>
      </div>

      <div className="ws-panel-body thread" role="log" aria-live="polite" aria-label="Conversation">
        <div className="msg msg-ai">
          <div className="bubble">{mission.starterPrompt}</div>
        </div>

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="msg msg-user">
                {message.kind === "image" && <span className="caption">Picture request</span>}
                <div className="bubble">{message.content}</div>
                {message.blocked && <div className="soft-block">Let&rsquo;s keep it about the mission. Try another way?</div>}
              </div>
            );
          }
          if (message.id === STREAMING_ID) {
            return (
              <div key={message.id} className="msg msg-ai">
                <div className={`bubble${message.content ? " is-streaming" : ""}`}>{message.content || "…"}</div>
              </div>
            );
          }
          if (message.id === PENDING_IMAGE_ID) {
            return (
              <div key={message.id} className="msg msg-ai">
                <div className="bubble is-streaming">Making your picture</div>
              </div>
            );
          }
          const pinned = pinnedMessageIds.has(message.id);
          return (
            <div key={message.id} className="msg msg-ai">
              {message.kind === "image" && message.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="picture" src={message.imageUrl} alt={message.content} />
              ) : (
                <div className="bubble">{message.content}</div>
              )}
              {!ended && (
                <div className="msg-actions">
                  <button className="btn" type="button" style={{ minHeight: 40 }} aria-pressed={pinned} onClick={() => !pinned && onPin(message.id)}>
                    {pinned ? "Pinned" : "Pin"}
                  </button>
                  {message.kind === "image" && message.parentId && (
                    <button className="btn" type="button" style={{ minHeight: 40 }} disabled={busy || remaining.images <= 0} onClick={() => onRetry(message.parentId!)}>
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {notice && (
          <div className="notice notice-warn" role="status" style={{ fontSize: 15, justifyContent: "space-between" }}>
            <span>{notice}</span>
            <button type="button" className="btn" style={{ minHeight: 32, padding: "2px 10px" }} onClick={onDismissNotice}>
              OK
            </button>
          </div>
        )}

        {ended ? (
          <div className="notice notice-good" style={{ fontSize: 16 }}>
            <span>
              This session has ended. Well done, {displayName}.{" "}
              <a href={galleryUrl} target="_blank" rel="noreferrer">
                Your class gallery →
              </a>
            </span>
          </div>
        ) : (
          <>
            <div className="composer-row">
              <textarea
                ref={textareaRef}
                className="input"
                aria-label={picture ? "Describe the picture you want" : "Message your helper"}
                placeholder={picture ? "Describe the picture you want…" : "Type here…"}
                value={text}
                rows={1}
                maxLength={picture ? 600 : 1500}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
              />
              {speech.supported && (
                <button
                  type="button"
                  className={`btn btn-icon${speech.listening ? " mic-on" : ""}`}
                  aria-pressed={speech.listening}
                  aria-label={speech.listening ? "Stop listening" : "Speak instead of typing"}
                  title={speech.listening ? "Stop listening" : "Speak instead of typing"}
                  onClick={speech.toggle}
                  disabled={busy}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </button>
              )}
              <button className="btn btn-primary btn-big" type="button" onClick={submit} disabled={busy || !text.trim()}>
                {busy ? "…" : picture ? "Make it" : "Send"}
              </button>
            </div>

            <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
              {mission.imageEnabled ? (
                <button
                  type="button"
                  className="btn"
                  style={{ minHeight: 40 }}
                  aria-pressed={picture}
                  disabled={!canPicture}
                  title={canPicture ? undefined : "No pictures left for this mission"}
                  onClick={() => setPicture((v) => !v)}
                >
                  Make a picture
                </button>
              ) : (
                <span />
              )}
              <div className="budgets" style={{ minWidth: 220 }}>
                <div className="budget">
                  <span>Messages</span>
                  <div className="bar" role="img" aria-label="Messages left">
                    <i style={{ width: `${Math.round(remaining.messages * 100)}%` }} />
                  </div>
                </div>
                {mission.imageEnabled && (
                  <div className="budget">
                    <span>Pictures</span>
                    <div className="bar" role="img" aria-label="Pictures left">
                      <i style={{ width: `${Math.round(remaining.images * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
