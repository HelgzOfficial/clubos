// Pulls the video id out of any of the YouTube URL shapes people actually
// paste — the standard watch link, a share link, a Shorts link, an embed
// link, or a bare id on its own. Returns null when it isn't a YouTube URL at
// all, which is what the "that doesn't look like a YouTube link" validation
// message keys off.
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // A bare video id (11 chars of the YouTube alphabet).
  if (/^[\w-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    // /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
      const id = parts[1];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
  }

  return null;
}

// nocookie host keeps YouTube from setting tracking cookies for people who
// only ever watch footage inside ClubOS.
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
