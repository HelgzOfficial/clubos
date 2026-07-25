"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Camera, X } from "lucide-react";
import { loadPlayerPhotos, savePlayerPhoto, removePlayerPhoto } from "@/lib/player-photos";

const sizeClasses = {
  sm: "h-12 w-12 text-sm rounded-full",
  lg: "h-24 w-24 text-2xl rounded-full",
  card: "w-full h-full text-3xl rounded-xl",
};

export function PlayerAvatar({
  playerId,
  initials,
  size = "sm",
  editable = false,
}: {
  playerId: string;
  initials: string;
  size?: "sm" | "lg" | "card";
  editable?: boolean;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const all = loadPlayerPhotos();
    setPhoto(all[playerId] ?? null);
  }, [playerId]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      savePlayerPhoto(playerId, dataUrl);
      setPhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    removePlayerPhoto(playerId);
    setPhoto(null);
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-navy-600 dark:bg-navy-800 flex items-center justify-center font-semibold ${sizeClasses[size]} ${editable ? "cursor-pointer group" : ""}`}
      onClick={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.click();
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={initials} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}

      {editable && (
        <>
          <div className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex transition-colors">
            <Camera size={size === "sm" ? 14 : 20} className="text-white" />
          </div>
          {photo && (
            <button
              onClick={handleRemove}
              className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-navy-800"
              title="Remove photo"
            >
              <X size={12} />
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </>
      )}
    </div>
  );
}
