import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export default function HeatmapLayer({ points }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    if (points && points.length > 0) {
      layerRef.current = L.heatLayer(
        points.map((p) => [p.lat, p.lng, p.weight]),
        {
          radius: 25,
          blur: 18,
          maxZoom: 17,
        },
      ).addTo(map);
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [points, map]);

  return null;
}
