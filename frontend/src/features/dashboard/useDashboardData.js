import { useEffect, useMemo, useState } from "react";

import useDistrictsGeojson from "../../hooks/useDistrictsGeojson";
import { getForecast } from "../../services/aiService";
import { useAppStore } from "../../store/useAppStore";
import { formatDateForApi } from "../../utils/date";
import { resolveDisplayDistrict } from "../../utils/districtUtils";
import { reportError } from "../../utils/logger";
import {
  normalizeIncidentType,
  normalizeReportType,
  normalizeWeatherOption,
} from "../../constants/reportOptions";

function isSameApiDate(left, right) {
  return formatDateForApi(new Date(left)) === formatDateForApi(right);
}

export default function useDashboardData({ language, t }) {
  const districtsGeojson = useDistrictsGeojson();
  const accidents = useAppStore((state) => state.accidents);
  const trafficReports = useAppStore((state) => state.trafficReports);
  const fetchAccidents = useAppStore((state) => state.fetchAccidents);
  const fetchHeatmap = useAppStore((state) => state.fetchHeatmap);
  const fetchWeather = useAppStore((state) => state.fetchWeather);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const weather = useAppStore((state) => state.weather);
  const currentUser = useAppStore((state) => state.currentUser);
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const openTrafficJamModal = useAppStore((state) => state.openTrafficJamModal);
  const fetchTrafficReports = useAppStore((state) => state.fetchTrafficReports);
  const focusedReportPoint = useAppStore((state) => state.focusedReportPoint);
  const filters = useAppStore((state) => state.filters);

  const [dashboardForecast, setDashboardForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  useEffect(() => {
    fetchAccidents();
    fetchHeatmap();
    fetchWeather();
    fetchTrafficReports();
  }, [
    fetchAccidents,
    fetchHeatmap,
    fetchWeather,
    fetchTrafficReports,
    selectedDate,
  ]);

  useEffect(() => {
    const fetchDashboardForecast = async () => {
      try {
        setForecastLoading(true);

        const forecast = await getForecast({
          selectedDate,
          refreshSeed: Date.now() + Math.floor(Math.random() * 1000000),
          styleHint: "short dashboard safety card",
          language,
        });

        setDashboardForecast(forecast);
      } catch (error) {
        reportError("Error fetching dashboard AI forecast:", error);
        setDashboardForecast(null);
      } finally {
        setForecastLoading(false);
      }
    };

    fetchDashboardForecast();
  }, [language, selectedDate]);

  const normalizedAccidents = useMemo(() => {
    return accidents.map((item) => ({
      ...item,
      district: resolveDisplayDistrict(item, districtsGeojson),
    }));
  }, [accidents, districtsGeojson]);

  const normalizedTrafficReports = useMemo(() => {
    return trafficReports.map((item) => ({
      ...item,
      district: resolveDisplayDistrict(item, districtsGeojson),
    }));
  }, [trafficReports, districtsGeojson]);

  const accidentsForSelectedDay = useMemo(() => {
    return normalizedAccidents.filter((item) => {
      if (!item.date || !selectedDate) return false;

      return isSameApiDate(item.date, selectedDate);
    });
  }, [normalizedAccidents, selectedDate]);

  const reportsForSelectedDay = useMemo(() => {
    return normalizedTrafficReports.filter((item) => {
      const created = item.createdAt || item.created_at;
      if (!created || !selectedDate) return false;

      return isSameApiDate(created, selectedDate);
    });
  }, [normalizedTrafficReports, selectedDate]);

  const combinedItemsForSelectedDay = useMemo(() => {
    const accidentItems = accidentsForSelectedDay.map((item) => ({
      ...item,
      source: "accident",
      lat: item.latitude ?? item.lat,
      lng: item.longitude ?? item.lng,
      weather: normalizeWeatherOption(item.weather),
      type: normalizeIncidentType(item.type || item.accident_type, "incident"),
      category:
        item.severity === "high"
          ? "High Severity Accident"
          : item.severity === "medium"
            ? "Medium Severity"
            : "Low Severity",
      createdAt: item.date,
      road: item.road || item.description || t("dashboard.historicalRecord"),
      crossroad: item.crossroad || "",
    }));

    const reportItems = reportsForSelectedDay.map((item) => ({
      ...item,
      source: "traffic",
      lat: item.lat,
      lng: item.lng,
      createdAt: item.createdAt || item.created_at,
      weather: normalizeWeatherOption(item.weather),
      type: normalizeReportType(item),
      road: item.road || t("common.unknownRoad"),
      crossroad: item.crossroad || "",
    }));

    return [...accidentItems, ...reportItems];
  }, [accidentsForSelectedDay, reportsForSelectedDay, t]);

  const filteredItems = useMemo(() => {
    return combinedItemsForSelectedDay.filter((item) => {
      const matchesDistrict =
        filters.district === "all" || item.district === filters.district;

      const itemType = normalizeIncidentType(item.type, "unknown");
      const selectedType = normalizeIncidentType(filters.type, filters.type);
      const itemWeather = normalizeWeatherOption(item.weather);
      const selectedWeather = normalizeWeatherOption(
        filters.weather,
        filters.weather,
      );

      const matchesType =
        filters.type === "all" || itemType === selectedType;

      const matchesWeather =
        filters.weather === "all" || itemWeather === selectedWeather;

      return matchesDistrict && matchesType && matchesWeather;
    });
  }, [combinedItemsForSelectedDay, filters]);

  const highSeverityCount = filteredItems.filter(
    (item) => item.category === "High Severity Accident",
  ).length;

  const activeJams = filteredItems.filter(
    (item) => item.category === "Active Traffic Jam",
  ).length;

  const allRecentActivity = useMemo(() => {
    return [...normalizedTrafficReports]
      .map((item) => ({
        ...item,
        createdAt: item.createdAt || item.created_at,
        road: item.road || t("common.unknownRoad"),
        crossroad: item.crossroad || "",
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [normalizedTrafficReports, t]);

  const districtCounts = useMemo(() => {
    const counts = {
      Almaty: 0,
      Baikonur: 0,
      Esil: 0,
      Nura: 0,
      Saryarka: 0,
      Saraishyk: 0,
    };

    filteredItems.forEach((item) => {
      const districtName = item.district;
      if (districtName && counts[districtName] !== undefined) {
        counts[districtName] += 1;
      }
    });

    return counts;
  }, [filteredItems]);

  const handleMarkTraffic = () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }

    openTrafficJamModal();
  };

  return {
    activeJams,
    allRecentActivity,
    dashboardForecastDisplay: dashboardForecast,
    districtCounts,
    filteredItems,
    focusedReportPoint,
    forecastLoading,
    handleMarkTraffic,
    highSeverityCount,
    maxDistrictValue: Math.max(...Object.values(districtCounts), 1),
    recentActivity: allRecentActivity.slice(0, 3),
    totalReportsCount: filteredItems.length,
    weather,
  };
}
