export const REPORT_TYPE_OPTIONS = [
  "traffic_jam",
  "collision",
  "pedestrian",
  "rollover",
  "roadwork",
  "public_event",
  "road_closure",
  "stalled_vehicle",
  "police_checkpoint",
  "debris",
  "flooding",
  "other",
];

export const INCIDENT_TYPE_OPTIONS = [
  ...REPORT_TYPE_OPTIONS,
  "incident",
  "unknown",
];

export const WEATHER_OPTIONS = [
  "clear",
  "cloudy",
  "rain",
  "heavy_rain",
  "snow",
  "ice",
  "fog",
  "storm",
  "hail",
  "strong_wind",
  "poor_visibility",
];

export const ANALYTICS_WEATHER_OPTIONS = [...WEATHER_OPTIONS, "unknown"];

export const INCIDENT_TYPE_COLORS = {
  traffic_jam: "#8b5cf6",
  collision: "#3b82f6",
  pedestrian: "#f59e0b",
  rollover: "#ef4444",
  roadwork: "#64748b",
  public_event: "#ec4899",
  road_closure: "#111827",
  stalled_vehicle: "#14b8a6",
  police_checkpoint: "#0ea5e9",
  debris: "#a16207",
  flooding: "#06b6d4",
  other: "#10b981",
  incident: "#22c55e",
  unknown: "#94a3b8",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function expandText(value) {
  const text = normalizeText(value);
  return `${text} ${text.replaceAll("_", " ")}`;
}

export function normalizeIncidentType(value, fallback = "other") {
  const text = expandText(value);

  if (!text.trim()) return fallback;

  if (text.includes("roadwork") || text.includes("road work")) {
    return "roadwork";
  }

  if (text.includes("public event") || text.includes("event")) {
    return "public_event";
  }

  if (text.includes("road closure") || text.includes("closure")) {
    return "road_closure";
  }

  if (text.includes("stalled vehicle")) {
    return "stalled_vehicle";
  }

  if (text.includes("police checkpoint")) {
    return "police_checkpoint";
  }

  if (text.includes("debris") || text.includes("road debris")) {
    return "debris";
  }

  if (text.includes("flooding")) {
    return "flooding";
  }

  if (text.includes("other")) {
    return "other";
  }

  if (
    text.includes("collision") ||
    text.includes("crash") ||
    text.includes("accident") ||
    text.includes("столк")
  ) {
    return "collision";
  }

  if (text.includes("pedestrian") || text.includes("пешеход")) {
    return "pedestrian";
  }

  if (
    text.includes("rollover") ||
    text.includes("overturn") ||
    text.includes("опрок")
  ) {
    return "rollover";
  }

  if (
    text.includes("traffic jam") ||
    text.includes("active traffic jam") ||
    text.includes("jam") ||
    text.includes("congestion") ||
    text.includes("пробк") ||
    text.trim() === "traffic"
  ) {
    return "traffic_jam";
  }

  if (
    text.includes("incident") ||
    text.includes("hazard") ||
    text.includes("danger")
  ) {
    return "incident";
  }

  if (text.includes("unknown")) {
    return "unknown";
  }

  return fallback;
}

export function normalizeReportType(report, fallback = "other") {
  const explicitType = normalizeIncidentType(report?.type, "");
  if (explicitType) return explicitType;

  return normalizeIncidentType(
    [
      report?.category,
      report?.accident_type,
      report?.description,
      report?.road_condition,
    ]
      .filter(Boolean)
      .join(" "),
    fallback,
  );
}

export function normalizeWeatherOption(value, fallback = "unknown") {
  const text = expandText(value);

  if (!text.trim()) return fallback;
  if (text.includes("clear") || text.includes("ясно")) return "clear";
  if (text.includes("cloud") || text.includes("облач")) return "cloudy";
  if (text.includes("heavy rain") || text.includes("ливень")) {
    return "heavy_rain";
  }
  if (text.includes("rain") || text.includes("дожд")) return "rain";
  if (text.includes("snow") || text.includes("снег")) return "snow";
  if (text.includes("ice") || text.includes("голол")) return "ice";
  if (text.includes("fog") || text.includes("туман")) return "fog";
  if (text.includes("storm") || text.includes("шторм")) return "storm";
  if (text.includes("hail") || text.includes("град")) return "hail";
  if (text.includes("strong wind") || text.includes("ветер")) {
    return "strong_wind";
  }
  if (text.includes("poor visibility") || text.includes("видим")) {
    return "poor_visibility";
  }
  if (text.includes("unknown")) return "unknown";

  return fallback;
}
