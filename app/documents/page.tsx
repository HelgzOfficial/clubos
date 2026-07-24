"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { documents as sampleDocuments, ClubDocument } from "@/lib/sample-data";
import { FileText, FileVideo, Search, Upload, Download, X } from "lucide-react";

const categories: ("All" | ClubDocument["category"])[] = [
  "All", "Match Packs", "Match Reports", "Policies", "Clips",
];

const fileIcon = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileText,
  mp4: FileVideo,
};

function formatSize(kb: number) {
  return kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`;
}

function extensionOf(name: string): ClubDocument["fileType"] {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "mp4" || ext === "mov") return "mp4";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "csv") return "xlsx";
  return "pdf";
}

// Sample documents don't have a real file behind them yet — generate a
// small placeholder so the Download button always does something honest,
// instead of pretending a fake PDF/MP4 exists.
function samplePlaceholderUrl(doc: ClubDocument) {
  const blob = new Blob(
    [`This is a placeholder for "${doc.name}".\n\nThis is sample data used while building ClubOS. Once real storage is connected, this button will download the actual file.`],
    { type: "text/plain" }
  );
  return URL.createObjectURL(blob);
}

type UploadedDoc = ClubDocument & { url: string };

export default function DocumentsPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState<ClubDocument["category"]>("Clips");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allDocuments: (ClubDocument | UploadedDoc)[] = [...uploaded, ...sampleDocuments];

  const filtered = allDocuments.filter((d) => {
    const matchesCategory = category === "All" || d.category === category;
    const matchesQuery =
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.linkedTo?.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  function handleFileChosen(file: File) {
    setPendingFile(file);
    setPendingCategory(file.type.startsWith("video/") ? "Clips" : "Match Reports");
    setShowUpload(true);
  }

  function confirmUpload() {
    if (!pendingFile) return;
    const newDoc: UploadedDoc = {
      id: `u-${Date.now()}`,
      name: pendingFile.name,
      category: pendingCategory,
      uploadedBy: "You",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      fileType: extensionOf(pendingFile.name),
      sizeKb: Math.round(pendingFile.size / 1024),
      url: URL.createObjectURL(pendingFile),
    };
    setUploaded((prev) => [newDoc, ...prev]);
    setShowUpload(false);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-neutral-500">{allDocuments.length} files across the club.</p>
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
            accept="video/mp4,.mp4,.mov,application/pdf,.pdf,.doc,.docx,.xlsx,.csv"
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

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-400">No documents match your search.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {filtered.map((d) => {
              const Icon = fileIcon[d.fileType];
              const isUploaded = "url" in d;
              return (
                <li key={d.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy-600/50 dark:hover:bg-navy-800/50 transition-colors">
                  <Icon size={18} className="text-neutral-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-neutral-400">
                      {d.linkedTo ? `${d.linkedTo} · ` : ""}Uploaded by {d.uploadedBy} · {d.date}
                    </p>
                  </div>
                  <Badge variant="neutral" className="hidden sm:inline-flex shrink-0">{d.category}</Badge>
                  <span className="text-xs text-neutral-400 w-16 text-right shrink-0">{formatSize(d.sizeKb)}</span>
                  <a
                    href={isUploaded ? (d as UploadedDoc).url : samplePlaceholderUrl(d)}
                    download={d.name}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-navy-600 dark:hover:bg-navy-800 hover:text-white transition-colors shrink-0"
                    title="Download"
                  >
                    <Download size={16} />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-neutral-400">
        Uploaded files are stored in this browser session only for now — they'll disappear on refresh until we connect permanent storage (Supabase).
      </p>

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
              onChange={(e) => setPendingCategory(e.target.value as ClubDocument["category"])}
              className="mb-5 w-full rounded-xl border border-white/10 bg-navy-600 dark:bg-navy-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-club-primary/30"
            >
              {categories.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={confirmUpload}
              className="w-full rounded-xl bg-club-primary text-navy-950 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Add to Documents
            </button>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
