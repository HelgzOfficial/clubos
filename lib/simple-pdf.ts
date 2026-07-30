// A minimal, dependency-free PDF writer for a single image plus a title and
// description — enough for "Download PDF" on a drill diagram.
//
// Why hand-rolled: this deployment can't add npm packages, and a full PDF
// library would be a large dependency for one page containing one JPEG. A PDF
// that embeds a JPEG is genuinely simple, because DCTDecode means the JPEG
// bytes go in verbatim with no re-encoding.

const PAGE_W = 595.28; // A4 portrait, in points
const PAGE_H = 841.89;
const MARGIN = 40;

// PDF strings are parenthesised, so those three characters must be escaped.
// Anything outside Latin-1 is dropped rather than mojibake'd, since the base
// Helvetica font can't represent it anyway.
function pdfText(s: string): string {
  return s
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + " " + word).length > maxChars) {
        out.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function bytesOf(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export function jpegDataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function buildImagePdf({
  jpeg, imageWidth, imageHeight, title, description,
}: {
  jpeg: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  title: string;
  description?: string;
}): Blob {
  const drawW = PAGE_W - MARGIN * 2;
  const drawH = drawW * (imageHeight / imageWidth);
  const titleY = PAGE_H - MARGIN - 6;
  const imageY = titleY - 18 - drawH;

  const lines = description ? wrap(description, 92) : [];
  let content = "";
  if (title) content += `BT /F1 17 Tf ${MARGIN} ${titleY.toFixed(2)} Td (${pdfText(title)}) Tj ET\n`;
  content += `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${MARGIN} ${imageY.toFixed(2)} cm /Im0 Do Q\n`;
  let y = imageY - 24;
  for (const line of lines) {
    if (y < MARGIN) break;
    content += `BT /F1 10 Tf ${MARGIN} ${y.toFixed(2)} Td (${pdfText(line)}) Tj ET\n`;
    y -= 13;
  }

  const objects: Uint8Array[] = [];
  const push = (s: string) => objects.push(bytesOf(s));

  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >> >> /Contents 4 0 R >>\nendobj\n`
  );
  push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  // The image object is the one piece with binary in the middle, so it's built
  // as three concatenated chunks rather than a template string.
  const imgHead = bytesOf(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  const imgTail = bytesOf(`\nendstream\nendobj\n`);
  const imgObj = new Uint8Array(imgHead.length + jpeg.length + imgTail.length);
  imgObj.set(imgHead, 0);
  imgObj.set(jpeg, imgHead.length);
  imgObj.set(imgTail, imgHead.length + jpeg.length);
  objects.push(imgObj);

  push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);

  const header = bytesOf(`%PDF-1.4\n`);
  const offsets: number[] = [];
  let cursor = header.length;
  for (const obj of objects) {
    offsets.push(cursor);
    cursor += obj.length;
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;

  // Flattened into one buffer rather than passed to Blob as an array of views:
  // a Uint8Array's backing buffer is only `ArrayBufferLike` to TypeScript, which
  // doesn't satisfy BlobPart.
  const parts = [header, ...objects, bytesOf(xref)];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const flat = new Uint8Array(new ArrayBuffer(total));
  let at = 0;
  for (const part of parts) {
    flat.set(part, at);
    at += part.length;
  }
  return new Blob([flat], { type: "application/pdf" });
}
