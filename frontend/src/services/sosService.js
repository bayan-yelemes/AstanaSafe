import api from "../api/client";
import { normalizeSosIncident } from "../utils/normalizers";

export async function getSosIncidents({ activeOnly = false } = {}) {
  const { data } = await api.get("/sos/incidents", {
    params: {
      active_only: activeOnly,
      limit: 200,
    },
  });

  return (data || []).map(normalizeSosIncident);
}

export async function createSosIncident(incident, currentUser) {
  const { data } = await api.post("/sos/incidents", {
    lat: incident.lat,
    lng: incident.lng,
    accuracy_m: incident.accuracyM ?? null,
    road: incident.road || null,
    crossroad: incident.crossroad || null,
    district: incident.district || null,
    incident_type: incident.incidentType || "Road accident",
    urgency: incident.urgency || "critical",
    description: incident.description || null,
    reporter_name:
      incident.reporterName ||
      currentUser?.full_name ||
      currentUser?.name ||
      "Emergency user",
    reporter_phone: incident.reporterPhone || currentUser?.phone || null,
    reporter_email: incident.reporterEmail || currentUser?.email || null,
  });

  return normalizeSosIncident(data);
}

export async function updateSosIncidentStatus(id, status) {
  const { data } = await api.patch(`/sos/incidents/${id}/status`, { status });

  return normalizeSosIncident(data);
}
