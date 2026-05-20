import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  BarChart3,
  Cloud,
  Clock3,
  MapPin,
  TriangleAlert,
} from "../components/UI/icons";
import Topbar from "../components/UI/Topbar";
import { useAppStore } from "../store/useAppStore";
import useDistrictsGeojson from "../hooks/useDistrictsGeojson";
import { getRawRealAccidents } from "../services/accidentsService";
import { resolveDisplayDistrict } from "../utils/districtUtils";
import { reportError } from "../utils/logger";
import {
  formatLocalDate,
  getIconWrapStyle,
  normalizeHistoricalSeverity,
  normalizeHistoricalType,
  normalizeUserReportSeverity,
  normalizeUserReportType,
  normalizeWeather,
} from "../features/analytics/analyticsMappers";
import { useI18n } from "../i18n";
import styles from "./Analytics.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

function MetricCard({
  title,
  value,
  subtitle,
  valueColor,
  subtitleBg,
  subtitleColor,
}) {
  return (
    <div className={styles.analyticsStyle1}>
      <div className={styles.analyticsStyle2}>{title}</div>

      <div
        style={{
          fontSize: 36,
          lineHeight: 1.05,
          fontWeight: 900,
          color: valueColor,
          marginBottom: 12,
        }}
      >
        {value}
      </div>

      <div
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          borderRadius: 999,
          padding: "6px 11px",
          fontSize: 11,
          fontWeight: 800,
          background: subtitleBg,
          color: subtitleColor,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function ChartCard({ icon, title, children, minHeight = 360 }) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid rgba(226, 232, 240, 0.9)",
        borderRadius: 20,
        boxShadow: "var(--shadow-card)",
        padding: 20,
        minHeight,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className={styles.analyticsStyle3}>
        {icon}
        <div className={styles.analyticsStyle4}>{title}</div>
      </div>

      <div className={styles.analyticsStyle5}>{children}</div>
    </div>
  );
}

export default function Analytics() {
  const { t, tt, tw, ts } = useI18n();
  const trafficReports = useAppStore((state) => state.trafficReports);
  const fetchTrafficReports = useAppStore((state) => state.fetchTrafficReports);
  const selectedDate = useAppStore((state) => state.selectedDate);

  const districtsGeojson = useDistrictsGeojson();
  const [realAccidents, setRealAccidents] = useState([]);

  useEffect(() => {
    fetchTrafficReports();
  }, [fetchTrafficReports, selectedDate]);

  useEffect(() => {
    getRawRealAccidents()
      .then(setRealAccidents)
      .catch((error) => {
        reportError("Failed to load real accidents:", error);
        setRealAccidents([]);
      });
  }, []);

  const selectedDayString = selectedDate ? formatLocalDate(selectedDate) : null;

  const historicalForDay = useMemo(() => {
    return (realAccidents || [])
      .map((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        const rawDate = item.accident_date_raw
          ? String(item.accident_date_raw).slice(0, 10)
          : null;

        return {
          source: "historical",
          id: `historical-${item.id}`,
          lat,
          lng,
          createdAt: rawDate ? `${rawDate}T12:00:00` : null,
          rawDate,
          district: resolveDisplayDistrict(
            {
              district: item.district,
              district_name: item.district_name,
              latitude: lat,
              longitude: lng,
            },
            districtsGeojson,
          ),
          normalizedType: normalizeHistoricalType(item),
          normalizedSeverity: normalizeHistoricalSeverity(item),
          weather: normalizeWeather(item.weather),
          road: item.description || "Historical accident record",
          crossroad: "",
          category: "Historical Accident",
        };
      })
      .filter((item) => {
        if (!item.rawDate || !selectedDayString) return false;
        return item.rawDate === selectedDayString;
      });
  }, [realAccidents, districtsGeojson, selectedDayString]);

  const reportsForDay = useMemo(() => {
    return trafficReports
      .map((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);
        const createdAt = item.created_at || item.createdAt || null;

        return {
          source: "user",
          id: `user-${item.id}`,
          lat,
          lng,
          createdAt,
          rawDate: createdAt ? formatLocalDate(createdAt) : null,
          district: resolveDisplayDistrict(
            {
              district: item.district,
              district_name: item.district_name,
              lat,
              lng,
            },
            districtsGeojson,
          ),
          normalizedType: normalizeUserReportType(item),
          normalizedSeverity: normalizeUserReportSeverity(item),
          weather: normalizeWeather(item.weather),
          road: item.road || "Unknown Road",
          crossroad: item.crossroad || "",
          category: item.category || "User Report",
        };
      })
      .filter((item) => {
        if (!item.rawDate || !selectedDayString) return false;
        return item.rawDate === selectedDayString;
      });
  }, [trafficReports, districtsGeojson, selectedDayString]);

  const allIncidentsForDay = useMemo(() => {
    return [...historicalForDay, ...reportsForDay];
  }, [historicalForDay, reportsForDay]);

  const totalIncidents = allIncidentsForDay.length;

  const highSeverityCount = useMemo(() => {
    return allIncidentsForDay.filter(
      (item) => item.normalizedSeverity === "high",
    ).length;
  }, [allIncidentsForDay]);

  const highSeverityRatio = useMemo(() => {
    if (!allIncidentsForDay.length) return "0.0";
    return ((highSeverityCount / allIncidentsForDay.length) * 100).toFixed(1);
  }, [highSeverityCount, allIncidentsForDay]);

  const peakHour = useMemo(() => {
    if (!allIncidentsForDay.length) return "0:00";

    const hourMap = {};

    allIncidentsForDay.forEach((item) => {
      if (!item.createdAt) return;
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) return;

      const hour = d.getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });

    let maxHour = 0;
    let maxCount = 0;

    Object.entries(hourMap).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxHour = Number(hour);
      }
    });

    return `${String(maxHour).padStart(2, "0")}:00`;
  }, [allIncidentsForDay]);

  const orderedDistricts = useMemo(
    () => ["Esil", "Nura", "Almaty", "Saryarka", "Baikonur", "Saraishyk"],
    [],
  );

  const safeDistricts = useMemo(() => {
    const districtMap = {};

    allIncidentsForDay.forEach((item) => {
      const district = item.district;
      districtMap[district] = (districtMap[district] || 0) + 1;
    });

    let safeCount = 0;

    orderedDistricts.forEach((district) => {
      const count = districtMap[district] || 0;
      if (count <= 2) safeCount += 1;
    });

    return `${safeCount}/${orderedDistricts.length}`;
  }, [allIncidentsForDay, orderedDistricts]);

  const districtCounts = {};
  const typeCounts = {};
  const weatherCounts = {};
  const hourCounts = Array(24).fill(0);

  allIncidentsForDay.forEach((item) => {
    const district = item.district || "Unknown";

    districtCounts[district] = (districtCounts[district] || 0) + 1;

    const type = item.normalizedType || "other";
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const weather = normalizeWeather(item.weather || "unknown");
    weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;

    let hour = 0;

    if (item.createdAt) {
      const d = new Date(item.createdAt);
      if (!Number.isNaN(d.getTime())) {
        hour = d.getHours();
      }
    }

    hourCounts[hour] += 1;
  });

  const reportsByDistrictData = {
    labels: orderedDistricts,
    datasets: [
      {
        label: t("analytics.reports"),
        data: orderedDistricts.map((district) => districtCounts[district] || 0),
        backgroundColor: "#6366f1",
        borderRadius: 8,
        barThickness: 20,
      },
    ],
  };

  const donutColors = {
    collision: "#3b82f6",
    pedestrian: "#f59e0b",
    rollover: "#ef4444",
    incident: "#06b6d4",
    "traffic jam": "#8b5cf6",
    unknown: "#94a3b8",
    other: "#10b981",
  };

  const incidentTypeOrder = [
    "collision",
    "pedestrian",
    "rollover",
    "traffic jam",
    "incident",
    "unknown",
    "other",
  ];

  const visibleTypes = incidentTypeOrder.filter(
    (type) => (typeCounts[type] || 0) > 0,
  );

  const incidentTypesData = {
    labels: visibleTypes.map((type) => tt(type)),
    datasets: [
      {
        data: visibleTypes.map((key) => typeCounts[key] || 0),
        backgroundColor: visibleTypes.map(
          (key) => donutColors[key] || "#94a3b8",
        ),
        borderWidth: 0,
        cutout: "72%",
        spacing: 6,
        borderRadius: 6,
      },
    ],
  };

  const weatherOrder = ["clear", "rain", "ice", "snow", "fog", "unknown"];

  const weatherImpactData = {
    labels: weatherOrder.map((item) => tw(item)),
    datasets: [
      {
        type: "bar",
        label: t("common.weather"),
        data: weatherOrder.map((item) => weatherCounts[item] || 0),
        backgroundColor: "#10b981",
        borderRadius: 10,
        barThickness: 22,
      },
      {
        type: "line",
        label: t("analytics.trend"),
        data: weatherOrder.map((item) => weatherCounts[item] || 0),
        borderColor: "#059669",
        backgroundColor: "#059669",
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#059669",
        pointBorderWidth: 2,
        pointRadius: 4,
        tension: 0.35,
      },
    ],
  };

  const hourlyTrendData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: t("analytics.incidents"),
        data: hourCounts,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.10)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2.5,
      },
    ],
  };

  const severityByDistrictData = useMemo(() => {
    const districtMap = orderedDistricts.reduce((acc, district) => {
      acc[district] = {
        low: 0,
        medium: 0,
        high: 0,
      };
      return acc;
    }, {});

    allIncidentsForDay.forEach((item) => {
      const district = item.district;
      const severity = item.normalizedSeverity;

      if (!districtMap[district]) return;

      if (severity === "high") {
        districtMap[district].high += 1;
      } else if (severity === "medium") {
        districtMap[district].medium += 1;
      } else {
        districtMap[district].low += 1;
      }
    });

    return {
      labels: orderedDistricts,
      datasets: [
        {
          label: ts("low"),
          data: orderedDistricts.map((district) => districtMap[district].low),
          backgroundColor: "#3b82f6",
          stack: "severity",
          borderSkipped: false,
          borderRadius: {
            topLeft: 0,
            topRight: 0,
            bottomLeft: 8,
            bottomRight: 8,
          },
          barThickness: 28,
        },
        {
          label: ts("medium"),
          data: orderedDistricts.map(
            (district) => districtMap[district].medium,
          ),
          backgroundColor: "#f59e0b",
          stack: "severity",
          borderSkipped: false,
          borderRadius: 0,
          barThickness: 28,
        },
        {
          label: ts("high"),
          data: orderedDistricts.map((district) => districtMap[district].high),
          backgroundColor: "#ef4444",
          stack: "severity",
          borderSkipped: false,
          borderRadius: {
            topLeft: 8,
            topRight: 8,
            bottomLeft: 0,
            bottomRight: 0,
          },
          barThickness: 28,
        },
      ],
    };
  }, [allIncidentsForDay, orderedDistricts, ts]);

  const severityChartMax = useMemo(() => {
    const totals = severityByDistrictData.labels.map((_, index) => {
      return severityByDistrictData.datasets.reduce((sum, dataset) => {
        return sum + (Number(dataset.data[index]) || 0);
      }, 0);
    });

    const maxTotal = Math.max(...totals, 0);

    if (maxTotal <= 10) return 10;
    if (maxTotal <= 20) return 20;
    if (maxTotal <= 30) return 30;
    if (maxTotal <= 40) return 40;
    if (maxTotal <= 50) return 50;

    return Math.ceil(maxTotal / 10) * 10;
  }, [severityByDistrictData]);

  const congestedRoadsData = useMemo(() => {
    const roadCounts = {};

    reportsForDay.forEach((item) => {
      const roadName =
        item.road || item.crossroad || item.street || "Unknown Road";
      roadCounts[roadName] = (roadCounts[roadName] || 0) + 1;
    });

    const sorted = Object.entries(roadCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      labels: sorted.map(([road]) => road),
      datasets: [
        {
          label: t("analytics.trafficJamDensity"),
          data: sorted.map(([, count]) => count),
          backgroundColor: "#8b5cf6",
          borderRadius: 999,
          barThickness: 16,
        },
      ],
    };
  }, [reportsForDay, t]);

  const axisCommon = {
    grid: {
      color: "rgba(148,163,184,0.15)",
      drawBorder: false,
      borderDash: [3, 4],
    },
    border: {
      display: false,
    },
    ticks: {
      color: "#94a3b8",
      font: {
        size: 11,
        weight: "500",
      },
    },
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        padding: 12,
      },
    },
    scales: {
      x: {
        ...axisCommon,
        grid: { display: false },
      },
      y: {
        ...axisCommon,
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
          padding: 12,
          color: "#64748b",
          font: {
            size: 12,
            weight: "600",
          },
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
      },
    },
  };

  const severityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          pointStyle: "rect",
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
          color: "#64748b",
          font: {
            size: 12,
            weight: "600",
          },
          generateLabels: (chart) => {
            const datasets = chart.data.datasets || [];
            const high = datasets.find((d) => d.label === ts("high"));
            const low = datasets.find((d) => d.label === ts("low"));
            const medium = datasets.find((d) => d.label === ts("medium"));

            return [high, low, medium].filter(Boolean).map((dataset) => ({
              text: dataset.label,
              fillStyle: dataset.backgroundColor,
              strokeStyle: dataset.backgroundColor,
              lineWidth: 0,
              hidden: false,
              datasetIndex: datasets.findIndex(
                (d) => d.label === dataset.label,
              ),
            }));
          },
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
      },
    },
    scales: {
      x: {
        stacked: true,
        ...axisCommon,
        grid: { display: false },
      },
      y: {
        stacked: true,
        ...axisCommon,
        beginAtZero: true,
        max: severityChartMax,
        ticks: {
          color: "#94a3b8",
          font: {
            size: 11,
            weight: "500",
          },
          stepSize: severityChartMax <= 10 ? 2 : 10,
        },
      },
    },
  };

  const reportByDistrictOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
      },
    },
    scales: {
      x: {
        ...axisCommon,
        grid: { display: false },
      },
      y: {
        ...axisCommon,
        beginAtZero: true,
      },
    },
  };

  const horizontalBarOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
      },
    },
    scales: {
      x: {
        ...axisCommon,
        beginAtZero: true,
        grid: { display: false },
        ticks: { display: false },
      },
      y: {
        ...axisCommon,
        grid: { display: false },
      },
    },
  };

  const weatherOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
      },
    },
    scales: {
      x: {
        ...axisCommon,
        grid: { display: false },
      },
      y: {
        ...axisCommon,
        beginAtZero: true,
      },
    },
  };

  return (
    <div className={styles.analyticsStyle6}>
      <Topbar title="Analytics" />

      <div
        className={["analytics-metric-grid", styles.analyticsStyle7]
          .filter(Boolean)
          .join(" ")}
      >
        <MetricCard
          title={t("analytics.totalIncidents")}
          value={totalIncidents}
          subtitle={t("analytics.historicalUserReports")}
          valueColor="#0f172a"
          subtitleBg="#f1f5f9"
          subtitleColor="#64748b"
        />

        <MetricCard
          title={t("analytics.highSeverityRatio")}
          value={`${highSeverityRatio}%`}
          subtitle={t("analytics.combinedDailySeverity")}
          valueColor="#ef4444"
          subtitleBg="#fef2f2"
          subtitleColor="#ef4444"
        />

        <MetricCard
          title={t("analytics.peakIncidentHour")}
          value={peakHour}
          subtitle={t("analytics.combinedDailyActivity")}
          valueColor="#9333ea"
          subtitleBg="#f5f3ff"
          subtitleColor="#9333ea"
        />

        <MetricCard
          title={t("analytics.safeDistricts")}
          value={safeDistricts}
          subtitle={t("analytics.basedOnAllIncidents")}
          valueColor="#10b981"
          subtitleBg="#ecfdf5"
          subtitleColor="#10b981"
        />
      </div>

      {allIncidentsForDay.length === 0 ? (
        <div className={styles.analyticsStyle8}>
          {t("analytics.noIncidents")}
        </div>
      ) : (
        <>
          <div
            className={["analytics-chart-grid", styles.analyticsStyle9]
              .filter(Boolean)
              .join(" ")}
          >
            <ChartCard
              title={t("analytics.hourlyDistribution")}
              icon={
                <div style={getIconWrapStyle("#eff6ff")}>
                  <Clock3 size={16} color="#3b82f6" />
                </div>
              }
              minHeight={330}
            >
              <div className={styles.analyticsStyle10}>
                <Line data={hourlyTrendData} options={lineChartOptions} />
              </div>
            </ChartCard>

            <ChartCard
              title={t("analytics.incidentTypes")}
              icon={
                <div style={getIconWrapStyle("#fef2f2")}>
                  <TriangleAlert size={16} color="#ef4444" />
                </div>
              }
              minHeight={330}
            >
              <div className={styles.analyticsStyle11}>
                <Doughnut data={incidentTypesData} options={doughnutOptions} />
              </div>
            </ChartCard>
          </div>

          <div
            className={["analytics-chart-grid", styles.analyticsStyle12]
              .filter(Boolean)
              .join(" ")}
          >
            <ChartCard
              title={t("analytics.severityByDistrict")}
              icon={
                <div style={getIconWrapStyle("#fff7ed")}>
                  <MapPin size={16} color="#f59e0b" />
                </div>
              }
              minHeight={330}
            >
              <div className={styles.analyticsStyle13}>
                <Bar data={severityByDistrictData} options={severityOptions} />
              </div>
            </ChartCard>

            <ChartCard
              title={t("analytics.reportsByDistrict")}
              icon={
                <div style={getIconWrapStyle("#eef2ff")}>
                  <MapPin size={16} color="#6366f1" />
                </div>
              }
              minHeight={330}
            >
              <div className={styles.analyticsStyle14}>
                <Bar
                  data={reportsByDistrictData}
                  options={reportByDistrictOptions}
                />
              </div>
            </ChartCard>
          </div>

          <div
            className={["analytics-chart-grid", styles.analyticsStyle15]
              .filter(Boolean)
              .join(" ")}
          >
            <ChartCard
              title={t("analytics.congestedArteries")}
              icon={
                <div style={getIconWrapStyle("#f5f3ff")}>
                  <BarChart3 size={16} color="#8b5cf6" />
                </div>
              }
              minHeight={350}
            >
              <div className={styles.analyticsStyle16}>
                {congestedRoadsData.labels.length === 0 ? (
                  <div className={styles.analyticsStyle17}>
                    {t("analytics.noTrafficRoadData")}
                  </div>
                ) : (
                  <Bar
                    data={congestedRoadsData}
                    options={horizontalBarOptions}
                  />
                )}
              </div>
            </ChartCard>

            <ChartCard
              title={t("analytics.weatherImpact")}
              icon={
                <div style={getIconWrapStyle("#ecfdf5")}>
                  <Cloud size={16} color="#10b981" />
                </div>
              }
              minHeight={350}
            >
              <div className={styles.analyticsStyle18}>
                <Bar data={weatherImpactData} options={weatherOptions} />
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
