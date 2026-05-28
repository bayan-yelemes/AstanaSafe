import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/UI/Topbar";
import SectionCard from "../components/UI/SectionCard";
import { AlertTriangle, Download, MapPin, X } from "../components/UI/icons";
import { useAppStore } from "../store/useAppStore";
import useDistrictsGeojson from "../hooks/useDistrictsGeojson";
import { getRawRealAccidents } from "../services/accidentsService";
import { getRawTrafficReports } from "../services/trafficReportsService";
import { resolveDisplayDistrict } from "../utils/districtUtils";
import { reportError } from "../utils/logger";
import {
  INCIDENT_TYPE_COLORS,
  normalizeIncidentType,
  normalizeReportType,
  normalizeWeatherOption,
} from "../constants/reportOptions";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { enGB, kk, ru } from "date-fns/locale";
import { useI18n } from "../i18n";
import styles from "./Reports.module.css";

const dateLocales = {
  en: enGB,
  ru,
  kz: kk,
};

const TYPE_BADGE_BACKGROUNDS = {
  traffic_jam: "#f5f3ff",
  collision: "#eef2ff",
  pedestrian: "#fff7ed",
  rollover: "#fef2f2",
  roadwork: "#f8fafc",
  public_event: "#fdf2f8",
  road_closure: "#f3f4f6",
  stalled_vehicle: "#f0fdfa",
  police_checkpoint: "#f0f9ff",
  debris: "#fefce8",
  flooding: "#ecfeff",
  incident: "#f0fdf4",
  other: "#f1f5f9",
  unknown: "#f1f5f9",
};

function formatLocalDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTableDate(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatTableTime(date) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function normalizeHistoricalType(item) {
  return normalizeIncidentType(
    [item?.accident_type, item?.description, item?.road_condition]
      .filter(Boolean)
      .join(" "),
    "unknown",
  );
}

function normalizeHistoricalSeverity(severity) {
  const text = String(severity || "")
    .trim()
    .toLowerCase();

  if (
    text.includes("high") ||
    text.includes("critical") ||
    text.includes("serious") ||
    text.includes("severe")
  ) {
    return "High";
  }

  if (text.includes("medium") || text.includes("moderate")) {
    return "Medium";
  }

  if (
    text.includes("low") ||
    text.includes("minor") ||
    text.includes("light")
  ) {
    return "Low";
  }

  return "Low";
}

function normalizeTrafficType(report) {
  return normalizeReportType(report);
}

function normalizeTrafficSeverity(report) {
  const category = String(report?.category || "")
    .trim()
    .toLowerCase();
  const type = String(report?.type || "")
    .trim()
    .toLowerCase();
  const severity = String(report?.severity || "")
    .trim()
    .toLowerCase();
  const combined = `${severity} ${category} ${type}`.trim();

  if (
    combined.includes("traffic jam") ||
    combined.includes("jam") ||
    combined.includes("congestion")
  ) {
    return "Traffic";
  }

  if (
    combined.includes("high") ||
    combined.includes("critical") ||
    combined.includes("serious") ||
    combined.includes("severe")
  ) {
    return "High";
  }

  if (combined.includes("medium") || combined.includes("moderate")) {
    return "Medium";
  }

  if (
    combined.includes("low") ||
    combined.includes("minor") ||
    combined.includes("light")
  ) {
    return "Low";
  }

  return "Traffic";
}

function normalizeWeather(value) {
  return normalizeWeatherOption(value);
}

function getTypeBadgeStyle(type) {
  return {
    bg: TYPE_BADGE_BACKGROUNDS[type] || "#f1f5f9",
    color: INCIDENT_TYPE_COLORS[type] || "#64748b",
  };
}

function getSeverityBadgeStyle(severity) {
  if (severity === "High") {
    return { color: "#ef4444", dot: "#ef4444" };
  }
  if (severity === "Medium") {
    return { color: "#f59e0b", dot: "#f59e0b" };
  }
  if (severity === "Low") {
    return { color: "#3b82f6", dot: "#3b82f6" };
  }
  return { color: "#8b5cf6", dot: "#8b5cf6" };
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatExportFileDate(date = new Date()) {
  return formatLocalDate(date).replaceAll("-", "");
}

function BigStatCard({ icon, iconBg, label, value, subtitle }) {
  return (
    <div className={styles.reportsStyle1}>
      <div className={styles.reportsStyle2}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "12px",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          {icon}
        </div>

        <div>
          <div className={styles.reportsStyle3}>{label}</div>

          <div className={styles.reportsStyle4}>{value}</div>

          <div className={styles.reportsStyle5}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { language, t, tt, ts, tw } = useI18n();
  const navigate = useNavigate();

  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const setFocusedReportPoint = useAppStore(
    (state) => state.setFocusedReportPoint,
  );

  const districtsGeojson = useDistrictsGeojson();
  const [allHistoricalAccidents, setAllHistoricalAccidents] = useState([]);
  const [allTrafficReports, setAllTrafficReports] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [historicalAccidents, trafficReports] = await Promise.all([
          getRawRealAccidents(),
          getRawTrafficReports(),
        ]);

        setAllHistoricalAccidents(historicalAccidents);
        setAllTrafficReports(trafficReports);
      } catch (error) {
        reportError("Failed to load reports page data:", error);
      }
    };

    loadAllData();
  }, []);

  const selectedDayString = selectedDate ? formatLocalDate(selectedDate) : null;

  const historicalRows = useMemo(() => {
    return allHistoricalAccidents
      .filter((a) => !!a.accident_date_raw)
      .map((a, index) => {
        const lat = Number(a.latitude);
        const lng = Number(a.longitude);

        const safeDate = a.accident_date_raw
          ? `${String(a.accident_date_raw).slice(0, 10)}T12:00:00`
          : null;

        return {
          id: `historical-${a.id ?? index}`,
          source: "historical",
          date: safeDate,
          district: resolveDisplayDistrict(
            {
              district: a.district,
              district_name: a.district_name,
              latitude: lat,
              longitude: lng,
            },
            districtsGeojson,
          ),
          type: normalizeHistoricalType(a),
          severity: normalizeHistoricalSeverity(a.severity),
          weather: normalizeWeather(a.weather),
          lat,
          lng,
        };
      });
  }, [allHistoricalAccidents, districtsGeojson]);

  const trafficRows = useMemo(() => {
    return allTrafficReports
      .filter((t) => !!(t.created_at || t.createdAt))
      .map((t, index) => {
        const lat = Number(t.lat);
        const lng = Number(t.lng);

        return {
          id: `traffic-${t.id ?? index}`,
          source: "traffic",
          date: t.created_at || t.createdAt,
          district: resolveDisplayDistrict(
            {
              district: t.district,
              district_name: t.district_name,
              lat,
              lng,
            },
            districtsGeojson,
          ),
          type: normalizeTrafficType(t),
          severity: normalizeTrafficSeverity(t),
          weather: normalizeWeather(t.weather),
          lat,
          lng,
        };
      });
  }, [allTrafficReports, districtsGeojson]);

  const allRows = useMemo(() => {
    return [...historicalRows, ...trafficRows].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  }, [historicalRows, trafficRows]);

  const filteredRows = useMemo(() => {
    const hasDateFilter = !!startDate || !!endDate;

    if (hasDateFilter) {
      return allRows.filter((row) => {
        const rowDate = new Date(row.date);

        if (startDate) {
          const from = new Date(startDate);
          from.setHours(0, 0, 0, 0);
          if (rowDate < from) return false;
        }

        if (endDate) {
          const to = new Date(endDate);
          to.setHours(23, 59, 59, 999);
          if (rowDate > to) return false;
        }

        return true;
      });
    }

    return allRows.filter((row) => {
      if (!row.date || !selectedDayString) return false;
      return formatLocalDate(row.date) === selectedDayString;
    });
  }, [allRows, startDate, endDate, selectedDayString]);

  const totalFilteredReports = filteredRows.length;

  const formatDistrictForLanguage = (district) => {
    const normalized = district || "Unknown";
    const translated = t(`districtName.${normalized}`);
    return translated === `districtName.${normalized}` ? normalized : translated;
  };

  const buildExportRows = () =>
    filteredRows.map((row) => ({
      dateTime: `${formatTableDate(row.date)} ${formatTableTime(row.date)}`,
      district: formatDistrictForLanguage(row.district),
      type: tt(row.type),
      severity: ts(row.severity),
      weather: tw(row.weather),
    }));

  const exportHeaders = () => [
    t("common.dateTime"),
    t("common.district"),
    t("common.type"),
    t("common.severity"),
    t("common.weather"),
  ];

  const highSeverityRate = useMemo(() => {
    if (!filteredRows.length) return "0%";
    const highCount = filteredRows.filter(
      (row) => row.severity === "High",
    ).length;
    return `${Math.round((highCount / filteredRows.length) * 100)}%`;
  }, [filteredRows]);

  const mostActiveDistrict = useMemo(() => {
    if (!filteredRows.length) return "-";

    const counts = {};
    filteredRows.forEach((row) => {
      const district = row.district || "Unknown";
      counts[district] = (counts[district] || 0) + 1;
    });

    let bestDistrict = "-";
    let bestCount = 0;

    Object.entries(counts).forEach(([district, count]) => {
      if (count > bestCount) {
        bestDistrict = district;
        bestCount = count;
      }
    });

    return bestDistrict;
  }, [filteredRows]);

  const clearDates = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const handleDownloadCsv = () => {
    const headers = exportHeaders();
    const rows = buildExportRows();
    const csvLines = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) =>
        [row.dateTime, row.district, row.type, row.severity, row.weather]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const csv = `\uFEFF${csvLines.join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(
      blob,
      `astanasafe-reports-${language}-${formatExportFileDate()}.csv`,
    );
  };

  const handleDownloadPdf = () => {
    const headers = exportHeaders();
    const rows = buildExportRows();
    const title = t("reports.historicalSafetyData");
    const subtitle = t("reports.auditTrail");
    const generatedAt = `${t("reports.generatedAt")}: ${formatTableDate(new Date())} ${formatTableTime(new Date())}`;
    const rowsLabel = `${t("reports.exportRows")}: ${rows.length}`;

    const tableRows = rows.length
      ? rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.dateTime)}</td>
                <td>${escapeHtml(row.district)}</td>
                <td>${escapeHtml(row.type)}</td>
                <td>${escapeHtml(row.severity)}</td>
                <td>${escapeHtml(row.weather)}</td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="5" class="empty">${escapeHtml(t("reports.noReportData"))}</td></tr>`;

    const html = `<!doctype html>
      <html lang="${language === "kz" ? "kk" : language}">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body {
              font-family: Arial, "Segoe UI", sans-serif;
              color: #0f172a;
              margin: 0;
              background: #ffffff;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              align-items: flex-start;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 14px;
              margin-bottom: 18px;
            }
            h1 {
              font-size: 22px;
              line-height: 1.2;
              margin: 0 0 8px;
            }
            p {
              margin: 0;
              color: #475569;
              font-size: 12px;
              line-height: 1.45;
            }
            .meta {
              text-align: right;
              white-space: nowrap;
              color: #475569;
              font-size: 11px;
              line-height: 1.7;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              text-align: left;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              font-size: 9px;
              border-bottom: 1px solid #cbd5e1;
              padding: 9px 8px;
            }
            td {
              border-bottom: 1px solid #e5e7eb;
              padding: 9px 8px;
              vertical-align: top;
            }
            tr:nth-child(even) td {
              background: #f8fafc;
            }
            .empty {
              color: #64748b;
              text-align: center;
              padding: 28px 8px;
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>${escapeHtml(title)}</h1>
              <p>${escapeHtml(subtitle)}</p>
            </div>
            <div class="meta">
              <div>${escapeHtml(generatedAt)}</div>
              <div>${escapeHtml(rowsLabel)}</div>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>`;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      downloadBlob(
        new Blob([html], { type: "text/html;charset=utf-8" }),
        `astanasafe-reports-${language}-${formatExportFileDate()}.html`,
      );
      return;
    }

    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleViewOnMap = (row) => {
    if (
      !Number.isFinite(row?.lat) ||
      !Number.isFinite(row?.lng) ||
      !row?.date
    ) {
      return;
    }

    setSelectedDate(new Date(row.date));

    setFocusedReportPoint({
      id: row.id,
      source: row.source,
      lat: row.lat,
      lng: row.lng,
      date: row.date,
      district: row.district,
      type: row.type,
      severity: row.severity,
      weather: row.weather,
    });

    navigate("/");
  };

  return (
    <div>
      <Topbar title="Reports" />

      <div className={styles.reportsStyle6}>
        <div
          className={["reports-stat-grid", styles.reportsStyle7]
            .filter(Boolean)
            .join(" ")}
        >
          <BigStatCard
            icon={<X size={15} color="#2563eb" />}
            iconBg="#eff6ff"
            label={t("reports.totalFilteredReports")}
            value={totalFilteredReports}
            subtitle={t("reports.historicalUserData")}
          />

          <BigStatCard
            icon={<AlertTriangle size={15} color="#ef4444" />}
            iconBg="#fef2f2"
            label={t("reports.highSeverityRate")}
            value={highSeverityRate}
            subtitle={t("reports.criticalProportion")}
          />

          <BigStatCard
            icon={<MapPin size={15} color="#f59e0b" />}
            iconBg="#fff7ed"
            label={t("reports.mostActiveDistrict")}
            value={mostActiveDistrict}
            subtitle={t("reports.highestVolumeArea")}
          />
        </div>

        <SectionCard>
          <div className={styles.reportsStyle8}>
            <div>
              <div className={styles.reportsStyle9}>
                {t("reports.historicalSafetyData")}
              </div>
              <div className={styles.reportsStyle10}>
                {t("reports.auditTrail")}
              </div>
            </div>

            <div className={styles.reportsStyle11}>
              <button
                onClick={handleDownloadCsv}
                className={styles.reportsStyle12}
              >
                <Download size={15} />
                CSV
              </button>

              <button
                onClick={handleDownloadPdf}
                className={styles.reportsStyle13}
              >
                <Download size={15} />
                {t("reports.pdfExport")}
              </button>
            </div>
          </div>

          <div className={styles.reportsStyle14}>
            <div className={styles.reportsStyle15}>
              <div className={styles.reportsStyle16}>
                {t("reports.startDate")}
              </div>

              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="dd.MM.yyyy"
                placeholderText="dd.mm.yyyy"
                locale={dateLocales[language] || enGB}
                isClearable
                wrapperClassName="reports-datepicker-wrapper"
                className="reports-datepicker-input"
                popperClassName="app-datepicker-popper"
                calendarClassName="app-datepicker-calendar"
                popperPlacement="bottom-start"
                onKeyDown={(event) => event.preventDefault()}
                onPaste={(event) => event.preventDefault()}
              />
            </div>

            <div className={styles.reportsStyle17}>
              <div className={styles.reportsStyle18}>
                {t("reports.endDate")}
              </div>

              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="dd.MM.yyyy"
                placeholderText="dd.mm.yyyy"
                locale={dateLocales[language] || enGB}
                isClearable
                wrapperClassName="reports-datepicker-wrapper"
                className="reports-datepicker-input"
                popperClassName="app-datepicker-popper"
                calendarClassName="app-datepicker-calendar"
                popperPlacement="bottom-start"
                onKeyDown={(event) => event.preventDefault()}
                onPaste={(event) => event.preventDefault()}
              />
            </div>

            <button
              type="button"
              onClick={clearDates}
              className={styles.reportsStyle19}
            >
              {t("common.clearDates")}
            </button>
          </div>

          <div className={styles.reportsStyle20}>
            <div>{t("common.dateTime")}</div>
            <div>{t("common.district")}</div>
            <div>{t("common.type")}</div>
            <div>{t("common.severity")}</div>
            <div>{t("common.weather")}</div>
            <div className={styles.reportsStyle21}>{t("common.actions")}</div>
          </div>

          {filteredRows.length === 0 ? (
            <div className={styles.reportsStyle22}>
              {t("reports.noReportData")}
            </div>
          ) : (
            filteredRows.map((row) => {
              const typeStyle = getTypeBadgeStyle(row.type);
              const severityStyle = getSeverityBadgeStyle(row.severity);

              return (
                <div key={row.id} className={styles.reportsStyle23}>
                  <div>
                    <div className={styles.reportsStyle24}>
                      {formatTableDate(row.date)}
                    </div>
                    <div className={styles.reportsStyle25}>
                      {formatTableTime(row.date)}
                    </div>
                  </div>

                  <div className={styles.reportsStyle26}>{row.district}</div>

                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: typeStyle.bg,
                        color: typeStyle.color,
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {tt(row.type)}
                    </span>
                  </div>

                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: severityStyle.color,
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "999px",
                          background: severityStyle.dot,
                          display: "inline-block",
                        }}
                      />

                      {ts(row.severity)}
                    </span>
                  </div>

                  <div className={styles.reportsStyle27}>{tw(row.weather)}</div>

                  <div className={styles.reportsStyle28}>
                    <button
                      type="button"
                      onClick={() => handleViewOnMap(row)}
                      className="report-action-button"
                      title={t("reports.viewOnMap")}
                    >
                      <MapPin className="report-action-arrow" size={17} />
                      <span className="report-action-label">
                        {t("reports.viewOnMap")}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </SectionCard>
      </div>

      <style>{`
        .reports-datepicker-wrapper {
          display: block;
          width: 100%;
        }

        .reports-datepicker-wrapper .reports-datepicker-input {
          width: 100%;
          height: 42px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface);
          padding: 0 12px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          outline: none;
          box-sizing: border-box;
        }

        .reports-datepicker-wrapper .react-datepicker__close-icon {
          right: 8px;
        }

        .react-datepicker {
          font-family: inherit;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }

        .react-datepicker__header {
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
        }

        .react-datepicker__current-month {
          color: #0f172a;
          font-weight: 700;
        }

        .react-datepicker__day-name,
        .react-datepicker__day {
          color: #334155;
        }

        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected {
          background: #2563eb;
          color: white;
          border-radius: 8px;
        }

        .report-action-button {
          margin-left: auto;
          border: none;
          background: transparent;
          color: var(--text-soft);
          height: 34px;
          min-width: 34px;
          border-radius: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 10px;
          transition: all 0.25s ease;
          overflow: hidden;
        }

        .report-action-arrow {
          font-size: 18px;
          font-weight: 800;
          line-height: 1;
          transition: all 0.25s ease;
        }

        .report-action-label {
          max-width: 0;
          opacity: 0;
          white-space: nowrap;
          overflow: hidden;
          font-size: 14px;
          font-weight: 700;
          transition: all 0.25s ease;
        }

        .report-action-button:hover {
          background: var(--text-heading);
          color: #ffffff;
          padding: 0 16px;
          min-width: 148px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
        }

        .report-action-button:hover .report-action-label {
          max-width: 120px;
          opacity: 1;
        }

        .report-action-button:hover .report-action-arrow {
          transform: translateX(-2px);
        }
      `}</style>
    </div>
  );
}


