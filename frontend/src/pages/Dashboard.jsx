import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  X,
  Search,
  CalendarDays,
  BarChart3,
  MapPin,
  AlertTriangle,
} from "../components/UI/icons";
import Topbar from "../components/UI/Topbar";
import StatCard from "../components/UI/StatCard";
import SectionCard from "../components/UI/SectionCard";
import FilterPanel from "../components/Filters/FilterPanel";
import AccidentMap from "../components/Map/AccidentMap";

import useDashboardData from "../features/dashboard/useDashboardData";
import { useI18n } from "../i18n";
import styles from "./Dashboard.module.css";

function LegendItem({ color, label }) {
  return (
    <div className={styles.dashboardStyle1}>
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "999px",
          background: color,
        }}
      />

      <span className={styles.dashboardStyle2}>{label}</span>
    </div>
  );
}

function getCategoryColor(category) {
  if (category === "High Severity Accident") return "#ef4444";
  if (category === "Medium Severity") return "#f59e0b";
  if (category === "Low Severity") return "#3b82f6";
  if (category === "Active Traffic Jam") return "#a855f7";
  return "#94a3b8";
}

function getCategoryIcon(category) {
  if (category === "Active Traffic Jam") {
    return <MapPin size={22} color="#a855f7" />;
  }
  return <AlertTriangle size={22} color="#ef4444" />;
}

function formatActivityTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivityDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB");
}

function formatActivityClock(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverityBadge(report) {
  if (report.category === "High Severity Accident") {
    return { label: "HIGH", bg: "#fee2e2", color: "#dc2626" };
  }
  if (report.category === "Medium Severity") {
    return { label: "MEDIUM", bg: "#fef3c7", color: "#d97706" };
  }
  if (report.category === "Low Severity") {
    return { label: "LOW", bg: "#dbeafe", color: "#2563eb" };
  }
  return { label: "TRAFFIC", bg: "#f3e8ff", color: "#9333ea" };
}

function RecentActivityItem({ report, compact = false, t, tc, tt, tw }) {
  return (
    <div
      style={{
        padding: compact ? "12px 0" : "14px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <div className={styles.dashboardStyle3}>
        <div
          style={{
            width: "10px",
            height: "10px",
            marginTop: "6px",
            borderRadius: "999px",
            background: getCategoryColor(report.category),
            flexShrink: 0,
          }}
        />

        <div className={styles.dashboardStyle4}>
          <div
            style={{
              fontSize: compact ? "13px" : "14px",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "4px",
            }}
          >
            {tc(report.category)}
          </div>

          <div
            style={{
              fontSize: compact ? "12px" : "13px",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            {report.road || t("common.unknownRoad")}
            {report.crossroad ? ` · ${report.crossroad}` : ""}
          </div>

          <div
            style={{
              fontSize: compact ? "12px" : "13px",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            {t("common.type")}: {tt(report.type || "unknown")} ·{" "}
            {t("common.weather")}: {tw(report.weather || "unknown")}
          </div>

          <div className={styles.dashboardStyle5}>
            {report.userName || "User"} · {formatActivityTime(report.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityLogRow({ report, t, tc }) {
  const badge = getSeverityBadge(report);
  const isTraffic = report.category === "Active Traffic Jam";

  return (
    <div className={styles.dashboardStyle6}>
      <div
        style={{
          width: "62px",
          height: "62px",
          borderRadius: "18px",
          background: isTraffic ? "#f5edff" : "#fff1f2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border)",
        }}
      >
        {getCategoryIcon(report.category)}
      </div>

      <div className={styles.dashboardStyle7}>
        <div className={styles.dashboardStyle8}>
          <div className={styles.dashboardStyle9}>
            {tc(report.category).toUpperCase()}
          </div>

          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "4px 8px",
              borderRadius: "999px",
              background: badge.bg,
              color: badge.color,
              letterSpacing: "0.06em",
            }}
          >
            {badge.label}
          </div>
        </div>

        <div className={styles.dashboardStyle10}>
          {report.road || t("common.unknownRoad")}
        </div>

        <div className={styles.dashboardStyle11}>
          {isTraffic
            ? t("dashboard.atIntersection", {
                crossroad: report.crossroad || t("common.unknownCrossroad"),
              })
            : t("dashboard.userReported", {
                category: tc(report.category),
                road: report.road || t("common.unknownRoad"),
              })}
        </div>
      </div>

      <div className={styles.dashboardStyle12}>
        <div className={styles.dashboardStyle13}>
          <CalendarDays size={22} color="var(--primary)" />×
        </div>
        <div className={styles.dashboardStyle14}>
          {formatActivityDate(report.createdAt)}
        </div>
        <div className={styles.dashboardStyle15}>
          {formatActivityClock(report.createdAt)}
        </div>
      </div>
    </div>
  );
}

function StatsMiniCard({ title, value, color }) {
  return (
    <div className={styles.dashboardStyle16}>
      <div className={styles.dashboardStyle17}>{title}</div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: 900,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DistrictReportRow({ name, value, maxValue, color }) {
  const width = maxValue > 0 ? `${(value / maxValue) * 100}%` : "0%";

  return (
    <div className={styles.dashboardStyle18}>
      <div className={styles.dashboardStyle19}>
        <span>{name}</span>
        <span className={styles.dashboardStyle20}>{value}</span>
      </div>

      <div className={styles.dashboardStyle21}>
        <div
          style={{
            width,
            height: "100%",
            background: color,
            borderRadius: "999px",
          }}
        />
      </div>
    </div>
  );
}

function AiForecastCard({ forecastData, loading, t }) {
  const risk = forecastData?.risk_level || "UNKNOWN";

  const riskColor =
    risk === "HIGH" ? "#ef4444" : risk === "MEDIUM" ? "#f59e0b" : "#22c55e";

  return (
    <div className={styles.dashboardStyle22}>
      <div className={styles.dashboardStyle23}>
        <Sparkles size={18} color="#ef4444" />
        <div className={styles.dashboardStyle24}>
          {t("dashboard.aiSafetyForecast")}
        </div>
      </div>

      {loading ? (
        <div className={styles.dashboardStyle25}>
          {t("dashboard.loadingForecast")}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "inline-block",
              alignSelf: "flex-start",
              background: riskColor,
              color: "white",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              marginBottom: "8px",
              flexShrink: 0,
            }}
          >
            {t("dashboard.risk", { risk })}
          </div>

          <div className={styles.dashboardStyle26}>
            {forecastData?.insight || t("dashboard.noForecast")}
          </div>

          <div className={styles.dashboardStyle27}>
            <div className={styles.dashboardStyle28}>
              {t("dashboard.recommendation")}
            </div>
            <div className={styles.dashboardStyle29}>
              {forecastData?.recommendation || t("dashboard.noRecommendation")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ActivityModal({ open, onClose, activities, t, tc, tt, tw }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [now] = useState(Date.now);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setSearch("");
        setTab("all");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const filtered = activities.filter((item) => {
    const q = search.toLowerCase().trim();

    const districtText =
      typeof item.district === "object"
        ? item.district?.name || ""
        : item.district || item.district_name || "";

    const roadText = item.road || "";
    const crossroadText = item.crossroad || "";
    const typeText = item.type || "";
    const categoryText = item.category || "";
    const userText = item.userName || "";

    const matchesSearch =
      q === "" ||
      districtText.toLowerCase().includes(q) ||
      roadText.toLowerCase().includes(q) ||
      crossroadText.toLowerCase().includes(q) ||
      typeText.toLowerCase().includes(q) ||
      categoryText.toLowerCase().includes(q) ||
      userText.toLowerCase().includes(q);

    const matchesTab =
      tab === "all" ||
      (tab === "accident" && item.category !== "Active Traffic Jam") ||
      (tab === "traffic" && item.category === "Active Traffic Jam");

    return matchesSearch && matchesTab;
  });

  const recentHourCount = filtered.filter((item) => {
    if (!item.createdAt) return false;
    return now - new Date(item.createdAt).getTime() <= 60 * 60 * 1000;
  }).length;

  const accidentsCount = filtered.filter(
    (item) => item.category !== "Active Traffic Jam",
  ).length;

  const trafficCount = filtered.filter(
    (item) => item.category === "Active Traffic Jam",
  ).length;

  return createPortal(
    <div
      className={["modal-backdrop", styles.dashboardStyle30]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={["motion-modal", styles.dashboardStyle31]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.dashboardStyle32}>
          <div className={styles.dashboardStyle33}>
            <div className={styles.dashboardStyle34}>
              <CalendarDays size={26} color="#ffffff" />
            </div>

            <div>
              <div className={styles.dashboardStyle35}>
                {t("dashboard.completeActivityLog")}
              </div>
              <div className={styles.dashboardStyle36}>
                {t("dashboard.activityLogSubtitle")}
              </div>
            </div>
          </div>

          <button onClick={onClose} className={styles.dashboardStyle37}>
            <X size={24} color="#94a3b8" />
          </button>
        </div>

        <div className={styles.dashboardStyle38}>
          <div className={styles.dashboardStyle39}>
            <div className={styles.dashboardStyle40}>
              <Search size={20} color="#94a3b8" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("dashboard.searchPlaceholder")}
                className={styles.dashboardStyle41}
              />
            </div>

            <div className={styles.dashboardStyle42}>
              {[
                { key: "all", label: t("common.all") },
                { key: "accident", label: t("common.accident") },
                { key: "traffic", label: t("common.traffic") },
              ].map((item) => {
                const active = tab === item.key;

                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    style={{
                      border: active ? "none" : "1px solid var(--border)",
                      background: active
                        ? "linear-gradient(135deg, var(--primary), var(--accent))"
                        : "var(--surface)",
                      color: active ? "#ffffff" : "var(--text-muted)",
                      height: "40px",
                      minWidth: "82px",
                      padding: "0 14px",
                      borderRadius: "14px",
                      fontSize: "13px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.dashboardStyle43}>
            <StatsMiniCard
              title={t("dashboard.totalLogs")}
              value={filtered.length}
              color="#172036"
            />
            <StatsMiniCard
              title={t("dashboard.recentHour")}
              value={recentHourCount}
              color="#2563eb"
            />
            <StatsMiniCard
              title={t("dashboard.accidents")}
              value={accidentsCount}
              color="#ef4444"
            />
            <StatsMiniCard
              title={t("dashboard.trafficJams")}
              value={trafficCount}
              color="#a855f7"
            />
          </div>

          <div className={styles.dashboardStyle44}>
            {filtered.length === 0 ? (
              <div className={styles.dashboardStyle45}>
                {t("dashboard.noMatchingActivity")}
              </div>
            ) : (
              filtered.map((report) => (
                <ActivityLogRow
                  key={report.id}
                  report={report}
                  t={t}
                  tc={tc}
                  tt={tt}
                  tw={tw}
                />
              ))
            )}
          </div>
        </div>

        <div className={styles.dashboardStyle46}>
          <button onClick={onClose} className={styles.dashboardStyle47}>
            {t("dashboard.closeLog")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Dashboard() {
  const { t, tc, tt, tw, language } = useI18n();
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const {
    activeJams,
    allRecentActivity,
    dashboardForecastDisplay,
    districtCounts,
    filteredItems,
    focusedReportPoint,
    forecastLoading,
    handleMarkTraffic,
    highSeverityCount,
    maxDistrictValue,
    recentActivity,
    totalReportsCount,
    weather,
  } = useDashboardData({ language, t });

  return (
    <div>
      <Topbar title="Dashboard" onMarkTrafficJam={handleMarkTraffic} />

      <ActivityModal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        activities={allRecentActivity}
        t={t}
        tc={tc}
        tt={tt}
        tw={tw}
      />

      <div className={styles.dashboardStyle48}>
        <div
          className={["dashboard-summary-grid", styles.dashboardStyle49]
            .filter(Boolean)
            .join(" ")}
        >
          <StatCard
            title={t("dashboard.totalReports")}
            value={totalReportsCount}
            subtitle={t("dashboard.highSeveritySubtitle", {
              count: highSeverityCount,
            })}
            accent="#ef4444"
            className={styles.dashboardStyle50}
          />

          <StatCard
            title={t("dashboard.activeJams")}
            value={activeJams}
            subtitle={t("dashboard.userMarkedJams")}
            accent="#8b5cf6"
            className={styles.dashboardStyle51}
          />

          <StatCard
            title={t("dashboard.weather")}
            value={
              weather.temperature !== null ? `${weather.temperature}°C` : "--"
            }
            subtitle={`${tw(weather.condition)}, ${weather.city}`}
            accent="#3b82f6"
            className={styles.dashboardStyle52}
          />

          <div className={styles.dashboardStyle53}>
            <AiForecastCard
              forecastData={dashboardForecastDisplay}
              loading={forecastLoading}
              t={t}
            />
          </div>
        </div>

        <div
          className={["dashboard-content-grid", styles.dashboardStyle54]
            .filter(Boolean)
            .join(" ")}
        >
          <SectionCard className={styles.dashboardStyle55}>
            <div className={styles.dashboardStyle56}>
              <div className={styles.dashboardStyle57}>
                <FilterPanel />

                <div className={styles.dashboardStyle58}>
                  {t("dashboard.showingReports", {
                    count: filteredItems.length,
                  })}
                </div>
              </div>

              <div className={styles.dashboardStyle59}>
                <AccidentMap
                  height="520px"
                  focusedReportPoint={focusedReportPoint}
                  externalReports={filteredItems}
                />

                <div className={styles.dashboardStyle60}>
                  <div className={styles.dashboardStyle61}>
                    {t("dashboard.mapLegend")}
                  </div>

                  <LegendItem
                    color="#ef4444"
                    label={tc("High Severity Accident")}
                  />
                  <LegendItem color="#f59e0b" label={tc("Medium Severity")} />
                  <LegendItem color="#3b82f6" label={tc("Low Severity")} />
                  <LegendItem
                    color="#a855f7"
                    label={tc("Active Traffic Jam")}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <div className={styles.dashboardStyle62}>
            <SectionCard>
              <div className={styles.dashboardStyle63}>
                <div className={styles.dashboardStyle64}>
                  <CalendarDays size={20} color="var(--primary)" />
                  <div className={styles.dashboardStyle65}>
                    {t("dashboard.recentActivity")}
                  </div>
                </div>

                {allRecentActivity.length > 3 ? (
                  <button
                    onClick={() => setActivityModalOpen(true)}
                    className={styles.dashboardStyle66}
                  >
                    {t("dashboard.showAll")}
                  </button>
                ) : null}
              </div>

              {recentActivity.length === 0 ? (
                <div className={styles.dashboardStyle67}>
                  {t("dashboard.noRecentReports")}
                </div>
              ) : (
                recentActivity.map((report) => (
                  <RecentActivityItem
                    key={report.id}
                    report={report}
                    compact
                    t={t}
                    tc={tc}
                    tt={tt}
                    tw={tw}
                  />
                ))
              )}
            </SectionCard>

            <SectionCard>
              <div className={styles.dashboardStyle68}>
                <BarChart3 size={20} color="var(--primary)" />
                <div className={styles.dashboardStyle69}>
                  {t("dashboard.districtReports")}
                </div>
              </div>

              <DistrictReportRow
                name="Almaty"
                value={districtCounts.Almaty}
                maxValue={maxDistrictValue}
                color="#f59e0b"
              />

              <DistrictReportRow
                name="Baikonur"
                value={districtCounts.Baikonur}
                maxValue={maxDistrictValue}
                color="#60a5fa"
              />

              <DistrictReportRow
                name="Esil"
                value={districtCounts.Esil}
                maxValue={maxDistrictValue}
                color="#2563eb"
              />

              <DistrictReportRow
                name="Nura"
                value={districtCounts.Nura}
                maxValue={maxDistrictValue}
                color="#10b981"
              />

              <DistrictReportRow
                name="Saryarka"
                value={districtCounts.Saryarka}
                maxValue={maxDistrictValue}
                color="#8b5cf6"
              />

              <DistrictReportRow
                name="Saraishyk"
                value={districtCounts.Saraishyk}
                maxValue={maxDistrictValue}
                color="#ec4899"
              />
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
