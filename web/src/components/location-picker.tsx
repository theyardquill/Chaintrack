"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_CENTER, DEMO_LOCATIONS } from "@/lib/geo";
import type { MapMarker } from "@/components/leaflet-canvas";

const LeafletCanvas = dynamic(() => import("@/components/leaflet-canvas"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" />,
});

export function LocationPicker({
  coords,
  onCoords,
  onName,
}: {
  coords: { lat: number; lng: number } | null;
  onCoords: (coords: { lat: number; lng: number }) => void;
  onName: (name: string) => void;
}) {
  const [err, setErr] = useState<string | null>(null);

  const markers: MapMarker[] = coords
    ? [{ id: "pick", lat: coords.lat, lng: coords.lng, label: "Selected location", variant: "pick" }]
    : [];

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setErr("Geolocation is not available in this browser — click the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setErr(null);
        onCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setErr("Could not get your location — click the map instead.")
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {DEMO_LOCATIONS.map((l) => (
          <Button
            key={l.name}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onName(l.name);
              onCoords({ lat: l.lat, lng: l.lng });
            }}
          >
            <MapPin className="mr-1 h-3 w-3" /> {l.name}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={useMyLocation}>
          <LocateFixed className="mr-1 h-3 w-3" /> Use my location
        </Button>
      </div>

      <LeafletCanvas
        markers={markers}
        center={coords ? [coords.lat, coords.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={coords ? 13 : 11}
        onPick={(lat, lng) => onCoords({ lat, lng })}
        className="z-0 h-64 w-full rounded-md"
      />

      <p className="text-xs text-muted-foreground">
        {coords
          ? `Selected: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
          : "Click the map to drop a pin, or choose a demo location above."}
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
