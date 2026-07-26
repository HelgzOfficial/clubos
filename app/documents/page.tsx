"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchClubDocuments, uploadClubDocument, deleteClubDocument, getClubDocumentUrl,
  type DbClubDocument, type DocumentCategory,
} from "@/lib/club-documents-db";
import { FileText, FileVideo, Search, Upload, Download, Trash2, X } from "lucide-react";

const categories: ("All" | DocumentCategory)[] = ["All", "Match Packs", "Match Reports", "Policies"];

const fileIcon: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileText,
  mp4: FileVideo,
};

function formatSize(kb: number) {
  return kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DbClubDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState<DocumentCategory>("Match Reports");
  const [pendingLinkedTo, setPendingLinkedTo] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDocuments(await fetchClubDocuments());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = documents.filter((d) => {
    const matchesCategory = category === "All" || d.category === category;
    const matchesQuery =
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      (d.linked_to ?? "").toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  function handleFileChosen(file: File) {
    setPendingFile(file);
    setPendingCategory(file.type.startsWith("video/") ? "Match Reports" : "Match Reports");
    setPendingLinkedTo("");
    setShowUpload(true);
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setError("");
    try {
      await uploadClubDocument(pendingCategory, pendingFile, pendingLinkedTo);
      await load();
      setShowUpload(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(d: DbClubDocument) {
    try {
      window.open(await getClubDocumentUrl(d.file_path), "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that file.");
    }
  }

  async function handleDelete(d: DbClubDocument) {
    if (!window.confirm(`Remove "${d.name}"? This can't be undone.`)) return;
    try {
      await deleteClubDocument(d.id, d.file_path);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that file.");
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-neutral-500">{documents.length} file{documents.length === 1 ? "" : "s"} across the club.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-club-primary text-navy-950 px-4 py-2 text-sm font-medium shrink-0 hover:opacity-90 transition-opacity"
          >
            <Upload size={15} /> Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf,.doc,.docx,.xlsx,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              category === c
                ? "bg-club-primary text-navy-950"
                : "bg-navy-600 dark:bg-navy-800 text-neutral-500 hover:text-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-neutral-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-400">
            {documents.length === 0 ? "No documents yet — upload your first file above." : "No documents match your search."}
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {filtered.map((d) => {
              const Icon = fileIcon[d.file_type] ?? FileText;
              return (
                <li key={d.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy-600/50 dark:hover:bg-navy-800/50 transition-colors">
                  <Icon size={18} className="text-neutral-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-neutral-400">
                      {d.linked_to ? `${d.linked_to} · ` : ""}
                      {new Date(d.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <Badge variant="neutral" className="hidden sm:inline-flex shrink-0">{d.category}</Badge>
                  <span className="text-xs text-neutral-400 w-16 text-right shrink-0">{formatSize(d.size_kb)}</span>
                  <button
                    onClick={() => handleDownload(d)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white transition-colors shrink-0"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showUpload && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Upload file</p>
              <button onClick={() => setShowUpload(false)} className="text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-neutral-500 truncate">{pendingFile.name}</p>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Category</label>
            <select
              value={pendingCategory}
              onChange={(e) => setPendingCategory(e.target.value as DocumentCategory)}
              className="mb-3 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            >
              {categories.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Linked to (optional)</label>
            <input
              value={pendingLinkedTo}
              onChange={(e) => setPendingLinkedTo(e.target.value)}
              placeholder="e.g. an opponent or player name"
              className="mb-5 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            />
            <button
              onClick={confirmUpload}
              disabled={uploading}
              className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Add to Documents"}
            </button>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
