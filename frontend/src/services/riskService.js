import api from "../api/client";

export async function analyzeRiskZone(params, signal) {
  const { data } = await api.get("/risk/analyze", {
    params,
    signal,
  });

  return data;
}
