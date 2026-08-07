import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export type CardTone = "default" | "club";

// Written as whole alternatives rather than as overrides bolted onto a shared
// base, because `cn` here is plain clsx with no conflict resolution: passing
// both "border-white/10" and "border-club-primary/30" would leave both in the
// class list and let stylesheet order silently decide the winner.
const TONES: Record<CardTone, string> = {
  default: "border-white/10 bg-navy-700 dark:bg-navy-900",
  // Solid club Primary, exactly the colour set in Settings > Appearance.
  club: "border-club-primary bg-club-primary text-navy-950",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return (
    <div
      // The tone is also exposed as an attribute so app/globals.css can flip
      // the text inside back to dark. The writing in these panels is set by
      // dozens of `text-neutral-*` classes spread across several files, all
      // chosen to be legible on a dark panel; on a filled Primary panel they'd
      // be pale-on-pale. Handling that in one CSS rule keeps it from becoming
      // an edit in every file that renders something inside a card.
      data-card-tone={tone}
      className={cn(
        "rounded-card border shadow-soft dark:shadow-softDark p-5 transition-colors",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-center justify-between", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-navy-200 dark:text-navy-300 tracking-wide uppercase", className)} {...props} />;
}
