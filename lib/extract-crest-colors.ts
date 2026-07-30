// Samples a crest/badge image and returns a handful of its most prominent
// colours (as hex strings), so Settings > Appearance can offer "pick from
// your crest" swatches instead of making someone hunt for hex codes.
export async function extractCrestColors(file: File, maxColors = 6): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  const size = 64; // downsample — we only need dominant colours, not pixel-perfect analysis
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue; // transparent
    const brightness = (r + g + b) / 3;
    if (brightness > 240 || brightness < 15) continue; // skip near-white/near-black backgrounds
    // Quantise so near-identical shades group together.
    const key = `${Math.round(r / 24) * 24}-${Math.round(g / 24) * 24}-${Math.round(b / 24) * 24}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([key]) => {
      const [r, g, b] = key.split("-").map(Number);
      return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("")}`;
    });
}
