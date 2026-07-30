// Time-of-day greeting plus the signed-in person's own first name, so the
// dashboard stops greeting everyone by the same hardcoded name.

export function greetingForHour(hour: number): string {
  // Boundaries chosen to match how people actually speak: "morning" until
  // midday, "afternoon" until 6pm, "evening" after that (including the small
  // hours, where "good evening" reads better than "good morning" at 2am).
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstNameOf(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "";
}

// Falls back gracefully: a full greeting with a name when we know it, and a
// plain greeting when we don't, rather than "Good morning, undefined".
export function personalGreeting(fullName: string | null | undefined, now: Date = new Date()): string {
  const greeting = greetingForHour(now.getHours());
  const first = firstNameOf(fullName);
  return first ? `${greeting}, ${first}` : greeting;
}
