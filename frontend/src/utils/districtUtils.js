function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);

    if (
      !Number.isFinite(xi) ||
      !Number.isFinite(yi) ||
      !Number.isFinite(xj) ||
      !Number.isFinite(yj)
    ) {
      continue;
    }

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygonGeometry(lng, lat, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  const outerRing = coordinates[0];
  return pointInRing([lng, lat], outerRing);
}

function pointInMultiPolygonGeometry(lng, lat, coordinates) {
  if (!Array.isArray(coordinates)) return false;

  for (const polygon of coordinates) {
    if (pointInPolygonGeometry(lng, lat, polygon)) {
      return true;
    }
  }

  return false;
}

function normalizeDistrictName(raw) {
  const text = String(raw || "").trim();
  if (!text) return "Unknown";

  const lower = text.toLowerCase();

  if (lower === "район") return "Unknown";
  if (lower.includes("unknown")) return "Unknown";
  if (lower.includes("citywide")) return "Unknown";

  if (
    lower.includes("есил") ||
    lower.includes("esil") ||
    lower.includes("yesil") ||
    lower.includes("есиль")
  ) {
    return "Esil";
  }

  if (lower.includes("алмат") || lower.includes("almaty")) {
    return "Almaty";
  }

  if (lower.includes("сарыар") || lower.includes("saryarka")) {
    return "Saryarka";
  }

  if (
    lower.includes("байкон") ||
    lower.includes("байқоңыр") ||
    lower.includes("baikonur") ||
    lower.includes("baykonur")
  ) {
    return "Baikonur";
  }

  if (lower.includes("нура") || lower.includes("nura")) {
    return "Nura";
  }

  if (
    lower.includes("сарайш") ||
    lower.includes("saraishyk") ||
    lower.includes("sarayshyk")
  ) {
    return "Saraishyk";
  }

  return text;
}

function getBestProperty(properties = {}) {
  const candidates = [
    properties.district_en,
    properties.DISTRICT_EN,
    properties.name_en,
    properties.NAME_EN,
    properties["name:en"],
    properties.name_object,
    properties.name_object_kaz,
    properties.region,
    properties.official_name,
    properties.OFFICIAL_NAME,
    properties.name_ru,
    properties.NAME_RU,
    properties["name:ru"],
    properties.name_kk,
    properties.NAME_KK,
    properties["name:kk"],
    properties.district,
    properties.DISTRICT,
    properties.name,
    properties.NAME,
    properties.Name,
    properties.label,
    properties.LABEL,
  ];

  for (const value of candidates) {
    const normalized = normalizeDistrictName(value);
    if (normalized !== "Unknown") {
      return normalized;
    }
  }

  return "Unknown";
}

export function getDistrictForPoint(lat, lng, geojson) {
  if (!geojson || !Array.isArray(geojson.features)) return "Unknown";

  const pointLat = Number(lat);
  const pointLng = Number(lng);

  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) {
    return "Unknown";
  }

  const matches = [];

  for (const feature of geojson.features) {
    const geometry = feature?.geometry;
    const properties = feature?.properties || {};

    if (!geometry || !geometry.type || !geometry.coordinates) continue;

    let containsPoint = false;

    if (geometry.type === "Polygon") {
      containsPoint = pointInPolygonGeometry(
        pointLng,
        pointLat,
        geometry.coordinates,
      );
    } else if (geometry.type === "MultiPolygon") {
      containsPoint = pointInMultiPolygonGeometry(
        pointLng,
        pointLat,
        geometry.coordinates,
      );
    }

    if (containsPoint) {
      const district = getBestProperty(properties);
      if (district !== "Unknown") {
        matches.push(district);
      }
    }
  }

  if (matches.length === 0) return "Unknown";

  if (matches.includes("Saraishyk")) return "Saraishyk";
  if (matches.includes("Nura")) return "Nura";
  if (matches.includes("Baikonur")) return "Baikonur";
  if (matches.includes("Saryarka")) return "Saryarka";
  if (matches.includes("Esil")) return "Esil";
  if (matches.includes("Almaty")) return "Almaty";

  return matches[0];
}

export function getDistrictLabel(value) {
  return normalizeDistrictName(value);
}

export function resolveDisplayDistrict(item, geojson) {
  const raw =
    item?.district || item?.district_name || item?.district?.name || "";

  const normalizedDirect = normalizeDistrictName(raw);

  if (normalizedDirect !== "Unknown") {
    return normalizedDirect;
  }

  const lat = Number(item?.lat ?? item?.latitude);
  const lng = Number(item?.lng ?? item?.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return getDistrictForPoint(lat, lng, geojson);
  }

  return "Unknown";
}
