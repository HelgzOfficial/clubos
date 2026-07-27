"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { club } from "@/lib/sample-data";
import { fetchMatches, type DbMatch } from "@/lib/matches-db";
import { fetchPlayerByEmail, type DbPlayer } from "@/lib/players-db";
import { fetchMatchDocuments, getMatchDocumentUrl, getMatchDocumentDownloadUrl, recordDocumentView, type DbMatchDocument } from "@/lib/match-documents-db";
import { DirectionsLinks } from "@/components/directions-links";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import { LogOut, FileText, AlertCircle, Download } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function PortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<DbPlayer | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [docsByMatch, setDocsByMatch] = useState<Record<string, DbMatchDocument[]>>({});
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<DbMatchDocument | null>(null);

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) {
        router.replace("/portal/login");
        return;
      }
      try {
        const p = await fetchPlayerByEmail(email);
        if (!p) {
          setNotLinked(true);
          setLoading(false);
          return;
        }
        setPlayer(p);
        const now = Date.now();
        const all = await fetchMatches();
        const upcoming = all.filter((m) => new Date(m.kickoff).getTime() >= now).slice(0, 8);
        setMatches(upcoming);
        const docLists = await Promise.all(upcoming.map((m) => fetchMatchDocuments(m.id)));
        const map: Record<string, DbMatchDocument[]> = {};
        upcoming.forEach((m, i) => { map[m.id] = docLists[i]; });
        setDocsByMatch(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your fixtures.");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markOpened(doc: DbMatchDocument) {
    if (!player) return;
    await recordDocumentView(doc.id, player.id);
    setOpenedIds((prev) => new Set(prev).add(doc.id));
  }

  function handleOpenDoc(doc: DbMatchDocument) {
    setViewing(doc);
    markOpened(doc);
  }

  async function handleDownloadDoc(doc: DbMatchDocument) {
    const url = await getMatchDocumentDownloadUrl(doc.file_path, doc.file_name);
    window.open(url, "_blank");
    markOpened(doc);
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/portal/login");
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <p className="text-sm text-neutral-400">The portal isn&apos;t connected yet.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }

  if (notLinked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 dark:bg-navy-950 px-4 text-white">
        <div className="w-full max-w-sm rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-6 shadow-softDark text-center">
          <AlertCircle size={20} className="mx-auto mb-2 text-amber-300" />
          <p className="font-medium">We couldn&apos;t find a player profile with that email</p>
          <p className="mt-1.5 text-sm text-neutral-400">Ask your club to add your email to your player profile, then try again.</p>
          <button onClick={handleSignOut} className="mt-4 text-sm text-neutral-400 hover:text-white underline underline-offset-2">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-800 dark:bg-navy-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div
              className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-navy-950 text-sm font-bold"
              style={{ backgroundColor: club.primaryColor }}
            >
              {club.crestInitials}
            </div>
            <h1 className="text-xl font-semibold">Hi {player?.name?.split(" ")[0]}</h1>
            <p className="text-sm text-neutral-400">Your upcoming fixtures</p>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
            <LogOut size={14} /> Sign out
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        {matches.length === 0 ? (
          <p className="text-sm text-neutral-400">No upcoming fixtures scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => {
              const docs = docsByMatch[m.id] ?? [];
              return (
                <div key={m.id} className="rounded-card border border-white/10 bg-navy-700 dark:bg-navy-900 p-4">
                  <p className="font-medium">{m.is_home ? "vs" : "@"} {m.opponent}</p>
                  <p className="mt-0.5 text-sm text-neutral-400">{formatDate(m.kickoff)} · {formatTime(m.kickoff)}{m.venue ? ` · ${m.venue}` : ""}</p>
                  <DirectionsLinks venue={m.venue} className="mt-2" />
                  {docs.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                      {docs.map((d) => (
                        <div
                          key={d.id}
                          className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-sm"
                        >
                          <button
                            onClick={() => handleOpenDoc(d)}
                            className="flex min-w-0 flex-1 items-center gap-2 hover:text-white transition-colors"
                          >
                            <FileText size={14} className="shrink-0 text-neutral-400" />
                            <span className="flex-1 truncate">{d.file_name}</span>
                          </button>
                          {openedIds.has(d.id) && <span className="shrink-0 text-[10px] text-emerald-400">Opened</span>}
                          <button
                            onClick={() => handleDownloadDoc(d)}
                            title="Download to this device"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white transition-colors"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewing && (
        <DocumentViewerModal
          fileName={viewing.file_name}
          fileType={viewing.file_type}
          getViewUrl={() => getMatchDocumentUrl(viewing.file_path)}
          getDownloadUrl={() => getMatchDocumentDownloadUrl(viewing.file_path, viewing.file_name)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
