"use client";

import type { EarlierPin, PlayMessage } from "@/lib/types";

type Props = {
  pins: { id: string; messageId: string; position: number }[];
  messages: PlayMessage[];
  earlier: EarlierPin[];
  ended: boolean;
  onUnpin: (pinId: string) => void;
};

/** This week's pins, which the child can change, then everything kept from earlier weeks. */
export function Board({ pins, messages, earlier, ended, onUnpin }: Props) {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const items = pins.map((pin) => ({ pin, message: byId.get(pin.messageId) })).filter((x) => x.message);

  const weeks: { label: string; pins: EarlierPin[] }[] = [];
  for (const pin of [...earlier].reverse()) {
    const label = `${pin.week ? `Week ${pin.week}` : "Earlier"} · ${pin.title}`;
    const group = weeks.find((w) => w.label === label);
    if (group) group.pins.unshift(pin);
    else weeks.push({ label, pins: [pin] });
  }

  return (
    <>
      <div className="ws-panel-head">
        <span className="section-label">My comic board</span>
        <span className="chip">{items.length + earlier.length} pinned</span>
      </div>
      <div className="ws-panel-body">
        <span className="section-label" style={{ display: "block", marginBottom: 10 }}>
          This week
        </span>
        {items.length === 0 ? (
          <p className="meta" style={{ fontSize: 15 }}>
            Press <b>Pin</b> on a message or picture you like. Everything you pin stays with you all term, and goes into the group gallery.
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

        {weeks.map((week) => (
          <div key={week.label} className="board-week">
            <span className="section-label">{week.label}</span>
            <div className="board-list">
              {week.pins.map((pin) => (
                <div key={pin.pinId} className="board-item is-earlier">
                  {pin.kind === "image" && pin.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pin.imageUrl} alt={pin.content} />
                  ) : (
                    <p>{pin.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
