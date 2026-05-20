export function normalizeBackendWeather(value) {
  if (!value) return "Unknown";

  const text = String(value).toLowerCase();

  if (text.includes("clear")) return "Clear";
  if (text.includes("cloud")) return "Cloudy";
  if (text.includes("fog")) return "Fog";
  if (text.includes("rain")) return "Rain";
  if (text.includes("snow")) return "Snow";
  if (text.includes("ice")) return "Ice";
  if (text.includes("storm")) return "Storm";
  if (text.includes("unknown")) return "Unknown";

  return value;
}

export function normalizeAccidentType(value) {
  if (!value) return "collision";

  const text = String(value).toLowerCase();

  if (text.includes("rollover")) return "rollover";
  if (text.includes("pedestrian")) return "pedestrian";
  if (text.includes("collision")) return "collision";

  return "collision";
}

export function normalizeSeverity(value) {
  if (!value) return "low";

  const text = String(value).toLowerCase();

  if (text.includes("high")) return "high";
  if (text.includes("medium")) return "medium";
  if (text.includes("low")) return "low";

  return "low";
}

export function normalizeWeatherCode(code) {
  if ([0].includes(code)) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";

  return "Unknown";
}

export function normalizeSosIncident(item) {
  return {
    id: item.id,
    reporterUserId: item.reporter_user_id ?? null,
    ticket: `SOS-AST-${String(item.id).padStart(4, "0")}`,
    lat: Number(item.lat),
    lng: Number(item.lng),
    accuracyM: item.accuracy_m ?? null,
    road: item.road || "",
    crossroad: item.crossroad || "",
    district: item.district || "",
    incidentType: item.incident_type || "Road accident",
    urgency: item.urgency || "critical",
    status: item.status || "new",
    description: item.description || "",
    reporterName: item.reporter_name || "",
    reporterPhone: item.reporter_phone || "",
    reporterEmail: item.reporter_email || "",
    notificationLog: item.notification_log || [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}
