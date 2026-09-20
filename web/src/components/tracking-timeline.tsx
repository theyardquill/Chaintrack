import { MapPin } from "lucide-react";
import type { Checkpoint } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

function dotColor(status: Checkpoint["status"]): string {
  switch (status) {
    case "Delivered":
      return "bg-emerald-500";
    case "OutForDelivery":
      return "bg-amber-500";
    case "InTransit":
      return "bg-blue-500";
    default:
      return "bg-zinc-300 dark:bg-zinc-600";
  }
}

export function TrackingTimeline({ checkpoints }: { checkpoints: Checkpoint[] }) {
  if (checkpoints.length === 0) {
    return <p className="text-sm text-muted-foreground">No checkpoints recorded yet.</p>;
  }
  const sorted = [...checkpoints].sort((a, b) => b.timestamp - a.timestamp);
  return (
    <ol className="relative space-y-6 border-l-2 border-border pl-6 ml-2">
      {sorted.map((c) => (
        <li key={c.id} className="relative">
          <span
            className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${dotColor(c.status)}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{c.location}</span>
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{fmtDate(c.timestamp)}</p>
        </li>
      ))}
    </ol>
  );
}