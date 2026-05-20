import api from "../api/client";
import { formatDateForApi } from "../utils/date";

export async function getTrafficReports(selectedDate) {
  const params = selectedDate ? { date: formatDateForApi(selectedDate) } : {};
  const { data } = await api.get("/traffic-reports", { params });

  return (data || []).map(normalizeTrafficReport);
}

export async function getRawTrafficReports() {
  const { data } = await api.get("/traffic-reports");

  return data || [];
}

export async function createTrafficReport(report, currentUser, selectedDate) {
  const { data } = await api.post("/traffic-reports", {
    lat: report.lat,
    lng: report.lng,
    road: report.road || null,
    crossroad: report.crossroad || null,
    category: report.category,
    type: report.type || null,
    weather: report.weather || null,
    district: report.district || null,
    duration_minutes: report.duration_minutes || null,
    traffic_flow: report.traffic_flow || null,
    lanes_blocked: report.lanes_blocked || null,
    notes: report.notes || null,
    user_name: currentUser?.full_name || currentUser?.name || "User",
    report_date: selectedDate ? formatDateForApi(selectedDate) : null,
  });

  return normalizeTrafficReport(data, currentUser);
}

export async function deleteTrafficReport(id) {
  await api.delete(`/traffic-reports/${id}`);
}

function normalizeTrafficReport(report, currentUser = null) {
  return {
    id: report.id,
    lat: report.lat,
    lng: report.lng,
    road: report.road || "",
    crossroad: report.crossroad || "",
    category: report.category,
    type: report.type || "",
    weather: report.weather || "",
    district: report.district || "",
    durationMinutes: report.duration_minutes || null,
    trafficFlow: report.traffic_flow || "",
    lanesBlocked: report.lanes_blocked || "",
    notes: report.notes || "",
    userName:
      report.user_name || currentUser?.full_name || currentUser?.name || "User",
    createdAt: report.created_at,
    userId:
      currentUser?.id ||
      currentUser?.email ||
      currentUser?.phone ||
      report.user_name ||
      `backend-user-${report.id}`,
    userEmail: currentUser?.email || "",
    userPhone: currentUser?.phone || "",
  };
}
