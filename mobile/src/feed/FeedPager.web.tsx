import React, { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@lingoloop/shared";

export type FeedEntry = { kind: "video"; item: FeedItem } | { kind: "end" };
interface PagerProps {
  items: FeedEntry[];
  height: number;
  onActiveChange: (index: number) => void;
  renderItem: (entry: FeedEntry, state: { isActive: boolean; isNear: boolean }) => React.ReactNode;
  onCommand: (command: "play" | "mute" | "save" | "replay") => void;
}

export function FeedPager({ items, height, onActiveChange, renderItem, onCommand }: PagerProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const container = root.current;
    if (!container || !height) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          const index = Number((entry.target as HTMLElement).dataset.index || 0);
          setActive(index);
          onActiveChange(index);
        }
      }
    }, { root: container, threshold: [0.6] });
    container.querySelectorAll("article[data-index]").forEach((article) => observer.observe(article));
    return () => observer.disconnect();
  }, [height, items.length, onActiveChange]);

  function go(index: number) {
    const next = Math.max(0, Math.min(items.length - 1, index));
    root.current?.scrollTo({ top: next * height, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function keydown(event: React.KeyboardEvent) {
    if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) return;
    if (["ArrowDown", "PageDown", "j"].includes(event.key)) { event.preventDefault(); go(activeRef.current + 1); }
    else if (["ArrowUp", "PageUp", "k"].includes(event.key)) { event.preventDefault(); go(activeRef.current - 1); }
    else if (event.key === " ") { event.preventDefault(); onCommand("play"); }
    else if (event.key.toLowerCase() === "m") onCommand("mute");
    else if (event.key.toLowerCase() === "s") onCommand("save");
    else if (event.key.toLowerCase() === "r") onCommand("replay");
  }
  return <div style={{ position: "relative", height: "100%", width: "100%" }}>
    <div ref={root} role="feed" aria-label="Vocabulary lessons" tabIndex={0} onKeyDown={keydown} style={{ height: "100%", overflowY: "auto", scrollSnapType: "y mandatory", overscrollBehavior: "contain", scrollbarWidth: "none", outline: "none" }}>
      {items.map((entry, index) => <article key={entry.kind === "video" ? entry.item.videoId : "end"} data-index={index} aria-posinset={index + 1} aria-setsize={-1} style={{ height, scrollSnapAlign: "start", scrollSnapStop: "always", overflow: "hidden", position: "relative" }}>
        {renderItem(entry, { isActive: index === active, isNear: Math.abs(index - active) <= 1 })}
      </article>)}
    </div>
    <div className="feed-desktop-nav">
      <button type="button" aria-label="Previous word" onClick={() => go(active - 1)} disabled={active === 0}>↑</button>
      <button type="button" aria-label="Next word" onClick={() => go(active + 1)} disabled={active >= items.length - 1}>↓</button>
    </div>
    <style>{`.feed-desktop-nav{position:absolute;right:-68px;top:45%;display:flex;flex-direction:column;gap:12px}.feed-desktop-nav button{width:48px;height:48px;border-radius:50%;border:1px solid #2E3240;background:#181A21;color:#F5F6FA;font-size:22px;cursor:pointer}.feed-desktop-nav button:hover{border-color:#C6F432;color:#C6F432}.feed-desktop-nav button:disabled{opacity:.3;cursor:not-allowed}@media(max-width:767px){.feed-desktop-nav{display:none}}`}</style>
  </div>;
}
