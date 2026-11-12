import { useState, useEffect, useCallback } from "react";
import { locationService } from "../features/locations/locationService";
import type { LocationDto } from "../features/locations/locationTypes";

export function useLocations() {
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLocations(await locationService.getLocations());
    } catch {
      setError("No se pudieron cargar las sedes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return {
    locations,
    loading,
    error,
    hasMultipleLocations: locations.length > 1,
    reload,
  };
}
