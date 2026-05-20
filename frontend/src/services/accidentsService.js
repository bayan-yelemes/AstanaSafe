import api from "../api/client";
import { normalizeDateString } from "../utils/date";
import {
  normalizeAccidentType,
  normalizeBackendWeather,
  normalizeSeverity,
} from "../utils/normalizers";

export async function getRealAccidents(params) {
  const { data } = await api.get("/real-accidents", { params });

  return (data || []).map((item) => ({
    id: item.id,
    source_id: item.source_id,
    latitude: item.latitude,
    longitude: item.longitude,
    date: normalizeDateString(item.accident_date_raw),
    type: normalizeAccidentType(item.accident_type),
    severity: normalizeSeverity(item.severity),
    weather: normalizeBackendWeather(item.weather),
    description: item.description || "",
    district: item.district || null,
    district_name: item.district || null,
    area_code: item.area_code || null,
    road_condition: item.road_condition || null,
    year: item.year || null,
  }));
}

export async function getRawRealAccidents(limit = 10000) {
  const { data } = await api.get("/real-accidents", {
    params: { limit },
  });

  return data || [];
}
