import api from "../api/client";
import { formatDateForApi } from "../utils/date";

export async function getDashboardInsight() {
  const { data } = await api.get("/ai/dashboard-insight");

  return {
    insight: data.insight || "No AI insight available.",
    summary: data.summary || null,
  };
}

export async function getForecast({
  selectedDate,
  refreshSeed,
  styleHint,
  language,
}) {
  const { data } = await api.get("/ai/forecast", {
    params: {
      date: selectedDate ? formatDateForApi(selectedDate) : undefined,
      refresh_seed: refreshSeed,
      style_hint: styleHint,
      lang: language,
    },
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

  return data;
}
