"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Checkpoint } from "@/lib/types";
import { DEFAULT_CENTER, resolveCoords } from "@/lib/geo";
import type { MapMarker } from "@/components/leaflet-canvas";

const LeafletCanvas = dynamic(() => import("@/components/leaflet-canvas"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-md bg-muted" />,
});

const VARIANT: Record<Checkpoint["status"], string> = {
  Registered: "registered",
  InTransit: "intransit",
  OutForDelivery: "outfordelivery",
  Delivered: "delivered",
  Failed: "failed",
  Cancelled: "cancelled",
};

export function CheckpointMap({ checkpoints }: { checkpoints: Checkpoint[] }) {
  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    [...checkpoints]
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((c, i) => {
        const p = resolveCoords(c);
        if (!p) return;
        out.push({
          id: c.id,
          lat: p.lat,
          lng: p.lng,
          label: `${i + 1}. ${c.location}`,
          sub: new Date(c.timestamp).toLocaleString(),
          variant: VARIANT[c.status],
        });
      });
    return out;
  }, [checkpoints]);

  if (markers.length === 0) return null;

  return (
    <LeafletCanvas
      markers={markers}
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      className="z-0 h-72 w-full rounded-md"
    />
  );
}
