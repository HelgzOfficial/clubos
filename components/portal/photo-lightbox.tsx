"use client";

import { X } from "lucide-react";

// Full-screen view of a player's headshot. Tapping anywhere closes it, which
// is the behaviour people expect from a phone photo viewer.
export function PhotoLightbox({
  photoUrl, name, onClose,
}: {
  photoUrl: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white"
      >
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt={name}
        className="max-h-full max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="absolute bottom-5 left-0 right-0 text-center text-sm text-white/70">{name}</p>
    </div>
  );
}
