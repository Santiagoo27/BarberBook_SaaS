import React from "react";
import { MapPin } from "lucide-react";
import type { LocationDto } from "./locationTypes";

interface LocationSelectorProps {
  locations: LocationDto[];
  selectedLocationId: string | null;
  onChange: (locationId: string | null) => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({ locations, selectedLocationId, onChange }) => {
  if (locations.length <= 1) return null;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <MapPin size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
      <select
        value={selectedLocationId ?? ""}
        onChange={e => onChange(e.target.value || null)}
        className="input-theme"
        style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", maxWidth: 220 }}
      >
        <option value="">Todas las sedes</option>
        {locations.filter(l => l.isActive).map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
};
