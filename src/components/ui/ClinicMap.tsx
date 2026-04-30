"use client";

import { useEffect, useState } from "react";
import type { Clinic } from "@/lib/types";

// Leaflet CSS is loaded via a link tag to avoid SSR issues
const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

interface ClinicMapProps {
  clinics: Clinic[];
  className?: string;
}

export default function ClinicMap({ clinics, className = "" }: ClinicMapProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
  } | null>(null);
  const [icon, setIcon] = useState<any>(null);

  // Dynamically import react-leaflet and leaflet to avoid SSR
  useEffect(() => {
    Promise.all([import("react-leaflet"), import("leaflet")]).then(
      ([rl, L]) => {
        // Fix default marker icon path issue with bundlers
        const defaultIcon = L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        setIcon(defaultIcon);
        setMapComponents({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          Popup: rl.Popup,
        });
      }
    );
  }, []);

  const mappable = clinics.filter(
    (c) => c.latitude != null && c.longitude != null
  );

  if (!MapComponents || !icon || mappable.length === 0) {
    return null;
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  // Calculate center from all markers
  const centerLat =
    mappable.reduce((sum, c) => sum + c.latitude!, 0) / mappable.length;
  const centerLng =
    mappable.reduce((sum, c) => sum + c.longitude!, 0) / mappable.length;

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div className={`rounded-xl overflow-hidden border border-neutral-200 ${className}`}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={mappable.length === 1 ? 15 : 10}
          style={{ height: "350px", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
          {mappable.map((c) => (
            <Marker key={c.id} position={[c.latitude!, c.longitude!]} icon={icon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-neutral-500">{c.code}</p>
                  {c.address && (
                    <p className="text-neutral-500 mt-1">{c.address}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </>
  );
}
