import { Car, Bus } from "lucide-react";
import { directionsUrl } from "@/lib/maps-directions";

// A small "Directions: Car / Public transport" pair, opening Google Maps
// aimed at the given venue. Renders nothing if there's no venue to point at.
export function DirectionsLinks({ venue, className = "" }: { venue: string | null | undefined; className?: string }) {
  if (!venue || !venue.trim()) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <a
        href={directionsUrl(venue, "driving")}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-club-primary underline underline-offset-2"
      >
        <Car size={12} /> Directions (car)
      </a>
      <a
        href={directionsUrl(venue, "transit")}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-club-primary underline underline-offset-2"
      >
        <Bus size={12} /> Directions (public transport)
      </a>
    </div>
  );
}
