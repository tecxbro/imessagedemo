import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CompiledEvent, RenderFrame } from "@/contracts";
import { defaultReactions, type IosMessagesAppProps } from "@/components/imessage/ios-messages-app";

type Options = {
  frame: RenderFrame;
  playing: boolean;
  enabled: boolean;
  resetKey: number;
  pause(): void;
  changed(): void;
  append(events: CompiledEvent[], settleMs?: number): void;
};

/** Transient menus use the existing shell; transcript edits stay canonical timeline events. */
export function useInteractivePreview({ frame, playing, enabled, resetKey, pause, changed, append }: Options): {
  shell: Partial<IosMessagesAppProps>;
  overlay: ReactNode;
} {
  const [active, setActive] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<string[] | null>(null);
  const [emojiTarget, setEmojiTarget] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("");
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const emojiInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setActive(false); setPressed(null); setThread(null); setSelection(null);
    setEmojiTarget(null); setNotice(""); setReply(null); setDraft("");
  }, [resetKey]);
  useEffect(() => { if (emojiTarget) emojiInput.current?.focus(); }, [emojiTarget]);
  useEffect(() => {
    if (!playing) return;
    setActive(false); setPressed(null); setThread(null); setSelection(null);
    setEmojiTarget(null); setNotice(""); setReply(null); setDraft("");
  }, [playing]);

  function begin() { pause(); changed(); setActive(true); setNotice(""); }
  function message(id: string) { return frame.messages.find(item => item.id === id && item.kind !== "app-card"); }
  function react(id: string, choice: { type?: string; emoji?: string }) {
    const target = message(id);
    if (!target) return;
    begin();
    const own = target.reactions?.find(item => item.byMe);
    const type = choice.emoji ? "custom" : choice.type ?? "love";
    const same = own?.type === type && own?.emoji === choice.emoji;
    append([{ type: "reaction", atMs: frame.timeMs, messageId: id, reactionId: own?.id ?? `preview-reaction-${id}`,
      reaction: same ? null : { type, byMe: true, ...(choice.emoji ? { emoji: choice.emoji } : {}) } }]);
    setPressed(null); setEmojiTarget(null); setEmoji("");
  }
  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    begin();
    const target = reply ? message(reply) : undefined;
    const id = `preview-message-${++sequence.current}`;
    append([{ type: "message", atMs: frame.timeMs, message: {
      id, text: value, kind: "text", direction: "outgoing", atMs: frame.nowMs, status: "delivered",
      ...(target ? { replyTo: { id: target.id, text: target.text, direction: target.direction } } : {}),
    } }], 700);
    setDraft(""); setReply(null); setThread(null);
  }

  if (!enabled) return { shell: {}, overlay: null };
  const live = active && !playing;
  const shell: Partial<IosMessagesAppProps> = {
    onLongPress(id) { if (!message(id)) return; begin(); setPressed(id); setThread(null); },
    onLongPressClose() { setPressed(null); },
    onTapback(id, choice) { react(id, choice); },
    messageActionItems: [
      { id: "reply", label: "Reply", icon: "reply" },
      { id: "copy", label: "Copy", icon: "copy" },
      { id: "select", label: "Select", icon: "select" },
    ],
    onPickReactionEmoji(id) { begin(); setPressed(null); setEmojiTarget(id); },
    async onMenuAction(id, action) {
      const target = message(id);
      if (!target) return;
      begin(); setPressed(null);
      if (action === "reply") { setReply(id); setThread(null); }
      if (action === "copy") {
        try { await navigator.clipboard.writeText(target.text); setNotice("Copied message"); }
        catch { setNotice("Clipboard access was blocked by the browser."); }
      }
      if (action === "select") {
        if (frame.messages.some(item => item.kind === "app-card")) setNotice("Selection is available before the tip card appears. Replay the demo to try it.");
        else setSelection([id]);
      }
    },
    onOpenThread(id) { begin(); setThread(id); },
    onCloseThread() { setThread(null); },
    onCloseSelectMode() { setSelection(null); },
    onSelectMessage(ids) { setSelection(ids.filter(id => Boolean(message(id)))); },
    onDeleteMessages(ids) {
      begin(); append(ids.filter(id => message(id)).map(messageId => ({ type: "remove" as const, atMs: frame.timeMs, messageId })));
      setSelection(null);
    },
    onForwardMessages() { setNotice("Forwarding is not connected in this local demo."); },
    composer: {
      value: live ? draft : frame.draft,
      placeholder: reply ? `Reply to ${frame.contact.name}` : "iMessage",
      onChange(value) { begin(); setDraft(value); }, onSend: send,
    },
    ...(live ? {
      renderReactions: defaultReactions,
      longPress: pressed ? { id: pressed } : null,
      longPressPose: null,
      thread: thread ? { rootId: thread } : null,
      selectMode: selection ? {} : null,
      selectedMessageIds: selection ?? [],
    } : {}),
  };
  const replyMessage = reply ? message(reply) : undefined;
  const overlay = <>
    {live && replyMessage && <div data-slot="preview-reply-context" style={{ position: "absolute", bottom: 78, left: 16, right: 16, zIndex: 30, background: "var(--im-bg)", border: "1px solid #aaa6", borderRadius: 16, padding: "8px 12px", fontSize: 13 }}>
      <button aria-label="Cancel reply" onClick={() => setReply(null)} style={{ float: "right" }}>×</button>
      <strong>Replying to {replyMessage.direction === "incoming" ? frame.contact.name : "yourself"}</strong>
      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyMessage.text}</div>
    </div>}
    {live && notice && <div role="status" style={{ position: "absolute", top: 156, left: 24, right: 24, zIndex: 80, padding: 10, borderRadius: 12, background: "#333", color: "white", fontSize: 13 }}>{notice}</div>}
    {live && emojiTarget && <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "#0006", display: "grid", placeItems: "center" }}>
      <div role="dialog" aria-modal="true" aria-label="Choose a reaction" onKeyDown={event => {
        if (event.key === "Escape") setEmojiTarget(null);
        if (event.key === "Tab") {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, input"));
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }} style={{ width: 306, padding: 20, borderRadius: 24, background: "var(--im-bg)", color: "var(--im-incoming-text)", boxShadow: "0 12px 40px #0005" }}>
        <strong>Choose a reaction</strong>
        <div style={{ display: "flex", justifyContent: "space-between", margin: "16px 0" }}>{["☕", "🧦", "👏", "😂", "❤️", "🙌"].map(value =>
          <button key={value} aria-label={value} onClick={() => react(emojiTarget, { emoji: value })} style={{ fontSize: 26, background: "transparent", border: 0 }}>{value}</button>)}</div>
        <form onSubmit={event => { event.preventDefault(); if (/\p{Extended_Pictographic}/u.test(emoji)) react(emojiTarget, { emoji }); }}>
          <input ref={emojiInput} aria-label="Emoji" placeholder="Paste an emoji" value={emoji} maxLength={20} onChange={event => setEmoji(event.target.value)} style={{ width: 190, color: "inherit", background: "transparent" }} />
          <button type="submit" disabled={!/\p{Extended_Pictographic}/u.test(emoji)}>React</button>
        </form>
        <button onClick={() => setEmojiTarget(null)} style={{ marginTop: 16 }}>Cancel</button>
      </div>
    </div>}
  </>;
  return { shell, overlay };
}
