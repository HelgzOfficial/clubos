import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calendarEvents } from "@/lib/sample-data";

const typeVariant = {
  match: "green" as const,
  training: "neutral" as const,
  meeting: "amber" as const,
};

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const year = 2026;
  const month = 6; // July (0-indexed)
  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const eventsByDate = new Map<string, typeof calendarEvents>();
  for (const e of calendarEvents) {
    const list = eventsByDate.get(e.date) ?? [];
    list.push(e);
    eventsByDate.set(e.date, list);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-neutral-500">{monthLabel}</p>
      </div>

      <Card>
        <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-neutral-400 mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-[92px]" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const events = eventsByDate.get(dateStr) ?? [];
            return (
              <div
                key={i}
                className="min-h-[92px] rounded-xl border border-black/5 dark:border-white/10 p-2 text-left"
              >
                <p className="text-xs font-medium text-neutral-400">{day}</p>
                <div className="mt-1 space-y-1">
                  {events.map((e) => (
                    <Badge key={e.title} variant={typeVariant[e.type]} className="block truncate text-[10px] leading-tight">
                      {e.title}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
