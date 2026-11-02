"use client";

import { useEffect, useState } from "react";
import type { GalleryData, GalleryItem } from "@/lib/gallery";
import { formatDate, formatTime } from "@/lib/format";

type Props = { data: GalleryData; publicUrl: string; mode: "teacher" | "public" };

export function Gallery({ data, publicUrl, mode }: Props) {
  const [open, setOpen] = useState<{ item: GalleryItem; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", publicUrl);
    }
  }

  const total = data.groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <div className="print-header">
        <b>{data.schoolName}</b> · {data.className} · Mission {String(data.mission.number).padStart(2, "0")}: {data.mission.title} · {formatDate(data.session.startedAt)}
      </div>

      <div className="page-head no-print">
        <div className="page-intro">
          <p className="section-label">
            {mode === "teacher" ? `${data.className} · ` : ""}Mission {String(data.mission.number).padStart(2, "0")} · {formatDate(data.session.startedAt)}
          </p>
          <h1 className="page-title">{data.mission.title}</h1>
          <p className="page-sub">
            {total} creation{total === 1 ? "" : "s"} from {data.groups.length} {data.groups.length === 1 ? "child" : "children"}.
            {mode === "teacher" && !data.session.endedAt ? " The session is still live: new pins appear when you reload." : ""}
          </p>
        </div>
        {mode === "teacher" && (
          <div className="actions">
            <button className="btn" type="button" onClick={copyLink}>
              {copied ? "Copied" : "Copy public link"}
            </button>
            <button className="btn" type="button" onClick={() => window.print()}>
              Print
            </button>
          </div>
        )}
      </div>

      {data.groups.length === 0 ? (
        <div className="card card-pad no-print">
          <p className="meta">Nothing pinned yet. Kids pin their best work from their creation board.</p>
        </div>
      ) : (
        <div className="gallery-groups">
          {data.groups.map((group) => (
            <section key={group.participantId} className="gallery-group">
              <div className="gallery-group-head">
                <h2 className="section-title">{group.name}</h2>
                <span className="meta">
                  {group.items.length} pin{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="masonry">
                {group.items.map((item) => (
                  <button key={item.id} type="button" className="card gallery-item" onClick={() => setOpen({ item, name: group.name })}>
                    {item.kind === "image" && item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.content} loading="lazy" />
                    ) : (
                      <p>{item.content}</p>
                    )}
                    <span className="caption">Pinned {formatTime(item.pinnedAt)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {open && (
        <div className="overlay no-print" role="dialog" aria-modal="true" aria-label={`${open.name}'s creation`} onClick={() => setOpen(null)}>
          <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
            {open.item.kind === "image" && open.item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.item.imageUrl} alt={open.item.content} />
            ) : (
              <div className="overlay-text">{open.item.content}</div>
            )}
            <div className="actions">
              <span className="overlay-caption">{open.name}</span>
              <button className="btn" type="button" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
