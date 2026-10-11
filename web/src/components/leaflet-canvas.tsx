"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
  variant?: string;
}

function pinIcon(variant = "registered") {
  return L.divIcon({
    className: "",
    html: `<span class="ct-pin ct-pin--${variant}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

function Resizer() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}

function FitBounds({ points, signature }: { points: [number, number][]; signature: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function LeafletCanvas({
  markers,
  center,
  zoom = 11,
  onPick,
  connect = false,
  className = "h-72 w-full rounded-md",
}: {
  markers: MapMarker[];
  center: [number, number];
  zoom?: number;
  onPick?: (lat: number, lng: number) => void;
  connect?: boolean;
  className?: string;
}) {
  const points = markers.map((m) => [m.lat, m.lng] as [number, number]);
  const signature = points.map((p) => p.join(",")).join("|");

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {connect && points.length > 1 && (
        <Polyline
          positions={points}
          pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.75, dashArray: "6 8" }}
        />
      )}
      <Resizer />
      <FitBounds points={points} signature={signature} />
      {onPick && <ClickCatcher onPick={onPick} />}
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon(m.variant)}>
          <Popup>
            <span className="font-medium">{m.label}</span>
            {m.sub ? (
              <>
                <br />
                <span>{m.sub}</span>
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
