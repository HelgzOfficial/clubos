// One place for how tabs and navigation look, so every tab strip in the app
// agrees with every other one.
//
// These were previously written out by hand on each button, in a dozen files,
// which is how they drifted: some tabs went grey on hover, some went white,
// some did nothing at all, and the sidebar's selected item used a plain panel
// colour rather than the club's. Anything that changes here now changes
// everywhere at once.

// The selected tab: filled with the club's Primary colour, with dark text on
// top of it. Primary is the colour Settings describes as "Buttons, highlights,
// active nav", so this is exactly what a club is choosing it for.
export const TAB_ACTIVE = "bg-club-primary text-navy-950 shadow-sm";

// An unselected tab that sits in a filled strip. Hovering tints it with the
// club colour rather than just brightening the text, so the tab you're about
// to click is obvious rather than merely legible.
export const TAB_IDLE =
  "bg-navy-600 dark:bg-navy-800 text-neutral-400 hover:bg-club-primary/20 hover:text-club-primary";

// The same, for tab strips that sit on their own background and have no fill
// of their own when unselected.
export const TAB_IDLE_PLAIN = "text-neutral-400 hover:bg-club-primary/15 hover:text-club-primary";

// And for tab strips drawn as outlined chips rather than filled ones — the
// outline picks up the club colour on hover too, so the whole chip responds
// rather than just the label inside it.
export const TAB_IDLE_OUTLINE =
  "border border-white/10 text-neutral-300 hover:border-club-primary/40 hover:bg-club-primary/15 hover:text-club-primary";

export type TabVariant = "filled" | "plain" | "outline";

export function tabState(active: boolean, variant: TabVariant = "filled"): string {
  if (active) return TAB_ACTIVE;
  if (variant === "plain") return TAB_IDLE_PLAIN;
  if (variant === "outline") return TAB_IDLE_OUTLINE;
  return TAB_IDLE;
}

// Sidebar / mobile navigation. The selected module gets the same filled
// treatment as a selected tab, so "where am I" reads identically whether
// you're looking at the nav down the side or the tabs across a page.
export const NAV_ACTIVE = "bg-club-primary text-navy-950";
export const NAV_IDLE =
  "text-neutral-300 hover:bg-club-primary/15 hover:text-club-primary";

export function navState(active: boolean): string {
  return active ? NAV_ACTIVE : NAV_IDLE;
}
