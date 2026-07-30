"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import {
  fetchMessages, sendMessage, markThreadRead, subscribeToThread, type MedicalMessage,
} from "@/lib/medical-messages-db";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// A single flat chat thread between a player and the medical team, shared
// by both the player-facing Treatment page (viewerRole="player") and the
// Medical module (viewerRole="doctor"). Used inside a card/modal, not as
// its own full page — the caller supplies the vertical space via className.
export function MessageThread({
  playerId, viewerRole, viewerName, viewerEmail, className = "",
}: {
  playerId: string;
  viewerRole: "doctor" | "player";
  viewerName: string;
  viewerEmail: string | null;
  className?: string;
}) {
  const [messages, setMessages] = useState<MedicalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMessages(playerId)
      .then((msgs) => { if (!cancelled) setMessages(msgs); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load messages."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    markThreadRead(playerId, viewerRole);

    const unsubscribe = subscribeToThread(playerId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.sender_role !== viewerRole) markThreadRead(playerId, viewerRole);
    });
    return () => { cancelled = true; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, viewerRole]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      const msg = await sendMessage({ playerId, senderRole: viewerRole, senderName: viewerName, senderEmail: viewerEmail, body });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={scrollRef} className="min-h-[220px] flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-white/10 bg-navy-800 dark:bg-navy-950 p-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-neutral-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center text-xs text-neutral-500">
            <MessageCircle size={18} className="text-neutral-600" />
            <p>No messages yet — say hello.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === viewerRole;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-club-primary text-navy-950" : "bg-navy-600 dark:bg-navy-800 text-white"}`}>
                  {!mine && <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">{m.sender_name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-navy-950/60" : "text-neutral-400"}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <form onSubmit={handleSend} className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={viewerRole === "player" ? "Message the medical team…" : "Message this player…"}
          className="flex-1 rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-club-primary text-navy-950 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}
