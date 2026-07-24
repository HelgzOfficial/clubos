const PHOTOS_KEY = "clubos_player_photos_v1";

export function loadPlayerPhotos(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PHOTOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePlayerPhoto(playerId: string, dataUrl: string) {
  if (typeof window === "undefined") return;
  const all = loadPlayerPhotos();
  all[playerId] = dataUrl;
  window.localStorage.setItem(PHOTOS_KEY, JSON.stringify(all));
}

export function removePlayerPhoto(playerId: string) {
  if (typeof window === "undefined") return;
  const all = loadPlayerPhotos();
  delete all[playerId];
  window.localStorage.setItem(PHOTOS_KEY, JSON.stringify(all));
}
