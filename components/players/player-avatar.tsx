"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { uploadPlayerPhoto, removePlayerPhoto } from "@/lib/players-db";

const sizeClasses = {
  sm: "h-12 w-12 text-sm rounded-full",
  lg: "h-24 w-24 text-2xl rounded-full",
  card: "w-full h-full text-3xl rounded-xl",
};

export function PlayerAvatar({
  playerId,
  initials,
  photoUrl = null,
  size = "sm",
  editable = false,
  onPhotoChanged,
}: {
  playerId: string;
  initials: string;
  photoUrl?: string | null;
  size?: "sm" | "lg" | "card";
  editable?: boolean;
  onPhotoChanged?: (photoUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const url = await uploadPlayerPhoto(playerId, file);
      onPhotoChanged?.(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setUploading(true);
    setError("");
    try {
      await removePlayerPhoto(playerId);
      onPhotoChanged?.(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-navy-600 dark:bg-navy-800 flex items-center justify-center font-semibold ${sizeClasses[size]} ${editable ? "cursor-pointer group" : ""}`}
      onClick={(e) => {
        if (!editable || uploading) return;
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.click();
      }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={initials} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={size === "sm" ? 14 : 20} className="animate-spin text-white" />
        </div>
      )}

      {editable && !uploading && (
        <>
          <div className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex transition-colors">
            <Camera size={size === "sm" ? 14 : 20} className="text-white" />
          </div>
          {photoUrl && (
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

      {error && (
        <div className="absolute -bottom-6 left-0 right-0 truncate text-center text-[10px] font-medium text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
