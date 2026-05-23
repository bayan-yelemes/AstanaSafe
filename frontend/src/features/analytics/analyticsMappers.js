import {
  normalizeIncidentType,
  normalizeReportType,
  normalizeWeatherOption,
} from "../../constants/reportOptions";

export function formatLocalDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeUserReportType(report) {
  return normalizeReportType(report);
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
  return normalizeIncidentType(
    [item?.accident_type, item?.description, item?.road_condition]
      .filter(Boolean)
      .join(" "),
    "unknown",
  );
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
  return normalizeWeatherOption(value);
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
