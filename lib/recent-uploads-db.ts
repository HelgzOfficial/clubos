import { supabase } from "./supabase";
import type { ClipSource } from "./clips-db";

// One merged "what's new" feed across everything staff and players upload:
// clip library videos (uploaded or YouTube), annotated/marked-up images, club
// documents, and documents attached to a specific fixture. Powers the Recent
// Uploads widget on the desktop dashboard and the same card in the player
// companion app, so a single fetch backs both instead of each rebuilding it.
export type RecentUploadKind = "clip" | "youtube" | "image" | "club-document" | "match-document" | "photo";

export type RecentUpload = {
  id: string;
  kind: RecentUploadKind;
  title: string;
  // Free-text context line: category, document type, or which fixture it hangs off.
  subtitle: string | null;
  createdAt: string;
  // Whatever the viewer needs to actually open it, by kind.
  filePath: string | null;
  fileName: string | null;
  fileType: string | null;
  youtubeId: string | null;
  matchId: string | null;
};

function safe<T>(promise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  // A missing table or column shouldn't blank the whole feed — each source
  // degrades to "nothing to show" on its own.
  return Promise.resolve(promise).then(
    ({ data, error }) => (error ? [] : data ?? []),
    () => []
  );
}

export async function fetchRecentUploads(limit = 12): Promise<RecentUpload[]> {
  if (!supabase) return [];

  const [clips, images, clubDocs, matchDocs, photos, matches] = await Promise.all([
    safe<{ id: string; title: string; category: string | null; file_path: string | null; file_name: string | null; file_type: string | null; source: ClipSource | null; youtube_id: string | null; match_id: string | null; uploaded_at: string }>(
      supabase.from("clips").select("id,title,category,file_path,file_name,file_type,source,youtube_id,match_id,uploaded_at").order("uploaded_at", { ascending: false }).limit(limit)
    ),
    safe<{ id: string; title: string; file_path: string; file_name: string; created_at: string }>(
      supabase.from("annotated_images").select("id,title,file_path,file_name,created_at").order("created_at", { ascending: false }).limit(limit)
    ),
    safe<{ id: string; name: string; category: string; file_path: string; file_name: string; file_type: string; uploaded_at: string }>(
      supabase.from("club_documents").select("id,name,category,file_path,file_name,file_type,uploaded_at").order("uploaded_at", { ascending: false }).limit(limit)
    ),
    safe<{ id: string; match_id: string; file_path: string; file_name: string; file_type: string; uploaded_at: string }>(
      supabase.from("match_documents").select("id,match_id,file_path,file_name,file_type,uploaded_at").order("uploaded_at", { ascending: false }).limit(limit)
    ),
    safe<{ id: string; caption: string | null; file_path: string; file_name: string; photo_url: string; match_id: string | null; uploaded_at: string }>(
      supabase.from("match_photos").select("id,caption,file_path,file_name,photo_url,match_id,uploaded_at").order("uploaded_at", { ascending: false }).limit(limit)
    ),
    safe<{ id: string; opponent: string; is_home: boolean }>(
      supabase.from("matches").select("id,opponent,is_home")
    ),
  ]);

  const matchLabel = new Map(matches.map((m) => [m.id, `${m.is_home ? "vs" : "@"} ${m.opponent}`]));

  const items: RecentUpload[] = [
    ...photos.map((p) => ({
      id: `photo-${p.id}`,
      kind: "photo" as const,
      title: p.caption || "Match photo",
      subtitle: p.match_id ? matchLabel.get(p.match_id) ?? "Match photo" : "Club photo",
      createdAt: p.uploaded_at,
      // The bucket is public, so the URL is the file — no signing step, which
      // is what lets a feed of thumbnails render immediately.
      filePath: p.photo_url,
      fileName: p.file_name,
      fileType: "jpg",
      youtubeId: null,
      matchId: p.match_id,
    })),
    ...clips.map((c) => {
      const isYouTube = (c.source ?? "upload") === "youtube";
      return {
        id: `clip-${c.id}`,
        kind: (isYouTube ? "youtube" : "clip") as RecentUploadKind,
        title: c.title,
        subtitle: c.category || (c.match_id ? matchLabel.get(c.match_id) ?? "Match highlight" : isYouTube ? "YouTube link" : "Clip"),
        createdAt: c.uploaded_at,
        filePath: c.file_path,
        fileName: c.file_name,
        fileType: c.file_type,
        youtubeId: c.youtube_id,
        matchId: c.match_id,
      };
    }),
    ...images.map((i) => ({
      id: `image-${i.id}`,
      kind: "image" as RecentUploadKind,
      title: i.title,
      subtitle: "Annotated image",
      createdAt: i.created_at,
      filePath: i.file_path,
      fileName: i.file_name,
      fileType: "png",
      youtubeId: null,
      matchId: null,
    })),
    ...clubDocs.map((d) => ({
      id: `club-doc-${d.id}`,
      kind: "club-document" as RecentUploadKind,
      title: d.name || d.file_name,
      subtitle: d.category,
      createdAt: d.uploaded_at,
      filePath: d.file_path,
      fileName: d.file_name,
      fileType: d.file_type,
      youtubeId: null,
      matchId: null,
    })),
    ...matchDocs.map((d) => ({
      id: `match-doc-${d.id}`,
      kind: "match-document" as RecentUploadKind,
      title: d.file_name,
      subtitle: matchLabel.get(d.match_id) ?? "Match document",
      createdAt: d.uploaded_at,
      filePath: d.file_path,
      fileName: d.file_name,
      fileType: d.file_type,
      youtubeId: null,
      matchId: d.match_id,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
