export function formatLocalDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeUserReportType(report) {
  const category = String(report?.category || "")
    .trim()
    .toLowerCase();
  const type = String(report?.type || "")
    .trim()
    .toLowerCase();
  const combined = `${category} ${type}`.trim();
  const normalizedCombined = `${combined} ${combined.replaceAll("_", " ")}`;

  if (
    normalizedCombined.includes("collision") ||
    normalizedCombined.includes("crash") ||
    normalizedCombined.includes("accident")
  ) {
    return "collision";
  }

  if (normalizedCombined.includes("pedestrian")) {
    return "pedestrian";
  }

  if (normalizedCombined.includes("rollover")) {
    return "rollover";
  }

  if (
    normalizedCombined.includes("traffic jam") ||
    normalizedCombined.includes("jam") ||
    normalizedCombined.includes("traffic")
  ) {
    return "traffic jam";
  }

  if (
    normalizedCombined.includes("roadwork") ||
    normalizedCombined.includes("road work")
  ) {
    return "roadwork";
  }

  if (
    normalizedCombined.includes("public event") ||
    normalizedCombined.includes("event")
  ) {
    return "public_event";
  }

  if (
    normalizedCombined.includes("road closure") ||
    normalizedCombined.includes("closure")
  ) {
    return "road_closure";
  }

  if (normalizedCombined.includes("stalled vehicle")) {
    return "stalled_vehicle";
  }

  if (normalizedCombined.includes("police checkpoint")) {
    return "police_checkpoint";
  }

  if (normalizedCombined.includes("debris")) {
    return "debris";
  }

  if (normalizedCombined.includes("flooding")) {
    return "flooding";
  }

  if (normalizedCombined.includes("incident")) {
    return "incident";
  }

  return "other";
}

export function normalizeUserReportSeverity(report) {
  const severity = String(report?.severity || "")
    .trim()
    .toLowerCase();
  const category = String(report?.category || "")
    .trim()
    .toLowerCase();
  const type = String(report?.type || "")
    .trim()
    .toLowerCase();
  const description = String(report?.description || "")
    .trim()
    .toLowerCase();

  const combined = `${severity} ${category} ${type} ${description}`.trim();

  if (
    combined.includes("low severity") ||
    combined.includes("low") ||
    combined.includes("minor") ||
    combined.includes("light")
  ) {
    return "low";
  }

  if (
    combined.includes("medium severity") ||
    combined.includes("medium") ||
    combined.includes("moderate") ||
    combined.includes("average")
  ) {
    return "medium";
  }

  if (
    combined.includes("high severity") ||
    combined.includes("high") ||
    combined.includes("severe") ||
    combined.includes("critical") ||
    combined.includes("serious")
  ) {
    return "high";
  }

  if (
    combined.includes("traffic jam") ||
    combined.includes("jam") ||
    combined.includes("congestion")
  ) {
    return "medium";
  }

  if (
    combined.includes("collision") ||
    combined.includes("accident") ||
    combined.includes("rollover")
  ) {
    return "high";
  }

  return "low";
}

export function normalizeHistoricalType(item) {
  const accidentType = String(item?.accident_type || "")
    .trim()
    .toLowerCase();
  const description = String(item?.description || "")
    .trim()
    .toLowerCase();
  const roadCondition = String(item?.road_condition || "")
    .trim()
    .toLowerCase();

  const combined = `${accidentType} ${description} ${roadCondition}`.trim();

  if (
    combined.includes("collision") ||
    combined.includes("accident") ||
    combined.includes("crash") ||
    combined.includes("столк")
  ) {
    return "collision";
  }

  if (combined.includes("pedestrian") || combined.includes("пешеход")) {
    return "pedestrian";
  }

  if (
    combined.includes("rollover") ||
    combined.includes("overturn") ||
    combined.includes("опрок")
  ) {
    return "rollover";
  }

  if (
    combined.includes("traffic jam") ||
    combined.includes("jam") ||
    combined.includes("congestion") ||
    combined.includes("пробк")
  ) {
    return "traffic jam";
  }

  if (
    combined.includes("incident") ||
    combined.includes("hazard") ||
    combined.includes("danger")
  ) {
    return "incident";
  }

  if (!combined) {
    return "unknown";
  }

  return "other";
}

export function normalizeHistoricalSeverity(item) {
  const value = String(item?.severity || "")
    .trim()
    .toLowerCase();

  if (value.includes("high")) return "high";
  if (value.includes("medium")) return "medium";
  if (value.includes("low")) return "low";

  return "low";
}

export function normalizeWeather(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();

  if (!text) return "unknown";
  if (text.includes("clear")) return "clear";
  if (text.includes("cloud")) return "cloudy";
  if (text.includes("heavy_rain") || text.includes("heavy rain")) return "heavy_rain";
  if (text.includes("rain")) return "rain";
  if (text.includes("snow")) return "snow";
  if (text.includes("ice")) return "ice";
  if (text.includes("fog")) return "fog";
  if (text.includes("storm")) return "storm";
  if (text.includes("hail")) return "hail";
  if (text.includes("strong_wind") || text.includes("strong wind")) return "strong_wind";
  if (text.includes("poor_visibility") || text.includes("poor visibility"))
    return "poor_visibility";

  return text;
}

export function getIconWrapStyle(bg) {
  return {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: bg,
    flexShrink: 0,
  };
}
