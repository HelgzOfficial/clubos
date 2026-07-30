import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <Card className="flex flex-col items-center justify-center py-20 text-center">
        <Icon size={32} className="mb-3 text-neutral-300 dark:text-neutral-600" />
        <p className="font-medium">This module is coming soon</p>
        <p className="text-sm text-neutral-400 mt-1 max-w-sm">
          {title} is part of the ClubOS roadmap and will be built in a future update.
        </p>
      </Card>
    </AppShell>
  );
}
