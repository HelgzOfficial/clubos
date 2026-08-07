import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export type CardTone = "default" | "club";

// Written as whole alternatives rather than as overrides bolted onto a shared
// base, because `cn` here is plain clsx with no conflict resolution: passing
// both "border-white/10" and "border-club-primary/30" would leave both in the
// class list and let stylesheet order silently decide the winner.
const TONES: Record<CardTone, string> = {
  default: "border-white/10 bg-navy-700 dark:bg-navy-900",
  // The tint is a gradient rather than a background colour on purpose. A
  // gradient is a background *image*, so it paints on top of the panel's own
  // colour — the club wash sits over the dark panel instead of replacing it
  // and letting the page background show through a semi-transparent hole.
  club:
    "border-club-primary/30 bg-navy-700 dark:bg-navy-900 bg-gradient-to-b from-club-primary/10 to-club-primary/10",
};

export function Card({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return (
    <div
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
