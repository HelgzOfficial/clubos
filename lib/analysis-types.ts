export type Clip = {
  id: string;
  title: string;
  url: string; // object URL — valid for this browser session only
  tags: string[];
  addedAt: string;
};

export type Playlist = {
  id: string;
  name: string;
  clipIds: string[];
};

let counter = 0;
export function nextAnalysisId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
