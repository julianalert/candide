"use client";

import type { PlayMessage } from "@/lib/types";

type Props = {
  pins: { id: string; messageId: string; position: number }[];
  messages: PlayMessage[];
  ended: boolean;
  onUnpin: (pinId: string) => void;
};

export function Board({ pins, messages, ended, onUnpin }: Props) {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const items = pins.map((pin) => ({ pin, message: byId.get(pin.messageId) })).filter((x) => x.message);

  return (
    <>
      <div className="ws-panel-head">
        <span className="section-label">My creation board</span>
        <span className="chip">{items.length} pinned</span>
      </div>
      <div className="ws-panel-body">
        {items.length === 0 ? (
          <p className="meta" style={{ fontSize: 15 }}>
            Press <b>Pin</b> on a message or picture you like. Everything here goes into the class gallery.
          </p>
        ) : (
          <div className="board-list">
            {items.map(({ pin, message }) => (
              <div key={pin.id} className="board-item">
                {message!.kind === "image" && message!.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={message!.imageUrl} alt={message!.content} />
                ) : (
                  <p>{message!.content}</p>
                )}
                {!ended && (
                  <button className="btn" type="button" style={{ alignSelf: "flex-start", minHeight: 40 }} onClick={() => onUnpin(pin.id)}>
                    Unpin
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
