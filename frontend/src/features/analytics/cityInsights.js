import { normalizeWeather } from "./analyticsMappers";
import { resolveDisplayDistrict } from "../../utils/districtUtils";

export const DISTRICT_ORDER = [
  "Esil",
  "Nura",
  "Almaty",
  "Saryarka",
  "Baikonur",
  "Saraishyk",
];

export const DISTRICT_LABELS = {
  Esil: "Есиль",
  Nura: "Нура",
  Almaty: "Алматы",
  Saryarka: "Сарыарка",
  Baikonur: "Байконур",
  Saraishyk: "Сарайшык",
  Unknown: "Неизвестно",
};

export const WEATHER_LABELS = {
  clear: "Ясно",
  rain: "Дождь",
  ice: "Гололед",
  snow: "Снег",
  fog: "Туман",
  storm: "Гроза",
  cloudy: "Облачно",
  unknown: "Неизвестно",
};

export function formatDistrictName(value) {
  return DISTRICT_LABELS[value] || value || "Неизвестно";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getYear(value) {
  const date = parseDate(value);
  return date ? date.getFullYear() : null;
}

function getHour(value) {
  const date = parseDate(value);
  return date ? date.getHours() : 12;
}

function getBucket(value, precision = 200) {
  const number = numberOrNull(value);
  if (number === null) return null;

  return Math.round(number * precision) / precision;
}

function getLocationKey(lat, lng, district) {
  const bucketLat = getBucket(lat);
  const bucketLng = getBucket(lng);

  if (bucketLat === null || bucketLng === null) {
    return `district:${district || "Unknown"}`;
  }

  return `point:${bucketLat}:${bucketLng}`;
}

function formatLocationLabel(lat, lng, district) {
  const bucketLat = getBucket(lat);
  const bucketLng = getBucket(lng);
  const districtLabel = formatDistrictName(district);

  if (bucketLat === null || bucketLng === null) {
    return `Район ${districtLabel}`;
  }

  return `Очаг ${districtLabel}: ${bucketLat.toFixed(3)}, ${bucketLng.toFixed(3)}`;
}

function normalizeSeverity(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("high")) return "high";
  if (text.includes("medium")) return "medium";
  return "low";
}

export function normalizeAnalyticsAccidents(accidents, districtsGeojson) {
  return (accidents || [])
    .map((item) => {
      const lat = numberOrNull(item.latitude);
      const lng = numberOrNull(item.longitude);
      if (lat === null || lng === null) return null;

      const rawDate = item.accident_date_raw || item.date || null;
      const district = resolveDisplayDistrict(
        {
          district: item.district,
          district_name: item.district_name,
          latitude: lat,
          longitude: lng,
        },
        districtsGeojson,
      );
      const description = String(item.description || "").trim();
      const fallbackLocation = formatLocationLabel(lat, lng, district);
      const roadLabel =
        item.road ||
        (description &&
        !description.toLowerCase().startsWith("unknown accident")
          ? description
          : fallbackLocation);

      return {
        id: `accident-${item.id}`,
        source: "accident",
        lat,
        lng,
        district,
        year: item.year || getYear(rawDate),
        hour: getHour(rawDate),
        weather: normalizeWeather(item.weather || item.road_condition || ""),
        severity: normalizeSeverity(item.severity),
        road: roadLabel,
      };
    })
    .filter(Boolean);
}

export function normalizeAnalyticsTrafficReports(reports, districtsGeojson) {
  return (reports || [])
    .map((item) => {
      const lat = numberOrNull(item.lat);
      const lng = numberOrNull(item.lng);
      if (lat === null || lng === null) return null;

      const rawDate = item.created_at || item.createdAt || null;
      const district = resolveDisplayDistrict(
        {
          district: item.district,
          district_name: item.district_name,
          lat,
          lng,
        },
        districtsGeojson,
      );

      return {
        id: `traffic-${item.id}`,
        source: "traffic",
        lat,
        lng,
        district,
        year: getYear(rawDate),
        hour: getHour(rawDate),
        weather: normalizeWeather(item.weather || ""),
        severity: "medium",
        road:
          [item.road, item.crossroad].filter(Boolean).join(" · ") ||
          formatLocationLabel(lat, lng, district),
      };
    })
    .filter(Boolean);
}

function increment(map, key, value = 1) {
  map[key] = (map[key] || 0) + value;
}

export function buildDangerZones(accidents, trafficReports, districtsGeojson) {
  const zones = new Map();
  const normalizedAccidents = normalizeAnalyticsAccidents(
    accidents,
    districtsGeojson,
  );
  const normalizedTraffic = normalizeAnalyticsTrafficReports(
    trafficReports,
    districtsGeojson,
  );

  const ensureZone = (item) => {
    const key =
      item.source === "traffic" && item.road
        ? `road:${item.road.toLowerCase()}:${item.district}`
        : getLocationKey(item.lat, item.lng, item.district);

    if (!zones.has(key)) {
      zones.set(key, {
        key,
        label:
          item.source === "traffic" && item.road
            ? item.road
            : formatLocationLabel(item.lat, item.lng, item.district),
        district: item.district,
        lat: item.lat,
        lng: item.lng,
        accidents: 0,
        traffic: 0,
        highSeverity: 0,
        hourCounts: Array(24).fill(0),
      });
    }

    return zones.get(key);
  };

  normalizedAccidents.forEach((item) => {
    const zone = ensureZone(item);
    zone.accidents += 1;
    if (item.severity === "high") zone.highSeverity += 1;
    zone.hourCounts[item.hour] += 1;
  });

  normalizedTraffic.forEach((item) => {
    const zone = ensureZone(item);
    zone.traffic += 1;
    zone.hourCounts[item.hour] += 1;
  });

  return Array.from(zones.values())
    .map((zone) => {
      const riskScore =
        zone.accidents * 3 + zone.traffic * 1.5 + zone.highSeverity * 2;
      const peakHour = zone.hourCounts.reduce(
        (best, count, hour) => (count > best.count ? { hour, count } : best),
        { hour: 0, count: 0 },
      ).hour;

      return {
        ...zone,
        riskScore,
        riskLevel:
          riskScore >= 45 ? "Критический" : riskScore >= 18 ? "Высокий" : "Средний",
        peakTime: `${String(peakHour).padStart(2, "0")}:00`,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

export function getAvailableYears(accidents, trafficReports) {
  const years = new Set();

  (accidents || []).forEach((item) => {
    const year = item.year || getYear(item.accident_date_raw || item.date);
    if (year) years.add(year);
  });

  (trafficReports || []).forEach((item) => {
    const year = getYear(item.created_at || item.createdAt);
    if (year) years.add(year);
  });

  return Array.from(years).sort((a, b) => b - a);
}

function filterByYear(items, year) {
  if (year === "all") return items;
  return items.filter((item) => String(item.year) === String(year));
}

function topEntries(counts, limit = 4) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function buildDistrictPassport(
  district,
  year,
  accidents,
  trafficReports,
  districtsGeojson,
) {
  const normalizedAccidents = filterByYear(
    normalizeAnalyticsAccidents(accidents, districtsGeojson),
    year,
  ).filter((item) => item.district === district);
  const normalizedTraffic = filterByYear(
    normalizeAnalyticsTrafficReports(trafficReports, districtsGeojson),
    year,
  ).filter((item) => item.district === district);

  const weatherCounts = {};
  const roadCounts = {};
  const hourly = Array(24).fill(0);

  normalizedAccidents.forEach((item) => {
    increment(weatherCounts, item.weather || "unknown");
    increment(roadCounts, item.road || formatLocationLabel(item.lat, item.lng, district));
    hourly[item.hour] += 1;
  });

  normalizedTraffic.forEach((item) => {
    increment(roadCounts, item.road || formatLocationLabel(item.lat, item.lng, district));
    hourly[item.hour] += 1;
  });

  const highSeverity = normalizedAccidents.filter(
    (item) => item.severity === "high",
  ).length;
  const total = normalizedAccidents.length + normalizedTraffic.length;
  const peakHour = hourly.reduce(
    (best, count, hour) => (count > best.count ? { hour, count } : best),
    { hour: 0, count: 0 },
  ).hour;

  let recommendation = "добавить предупреждающие знаки";
  if (highSeverity >= 6 || total >= 30) {
    recommendation = "усилить контроль";
  } else if (normalizedTraffic.length >= normalizedAccidents.length) {
    recommendation = "проверить светофор";
  }

  return {
    district,
    accidents: normalizedAccidents.length,
    traffic: normalizedTraffic.length,
    highSeverity,
    total,
    peakHour: `${String(peakHour).padStart(2, "0")}:00`,
    hourly,
    topRoads: topEntries(roadCounts),
    weatherFactors: topEntries(weatherCounts).map((item) => ({
      ...item,
      label: WEATHER_LABELS[item.label] || item.label,
    })),
    recommendation,
  };
}
