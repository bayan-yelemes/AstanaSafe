import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  LogOut,
  Trash2,
  Plus,
  MapPin,
  Download,
} from "../components/UI/icons";
import Topbar from "../components/UI/Topbar";
import SectionCard from "../components/UI/SectionCard";
import { useAppStore } from "../store/useAppStore";
import { getRawTrafficReports } from "../services/trafficReportsService";
import { reportError } from "../utils/logger";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { enGB } from "date-fns/locale";
import { useI18n } from "../i18n";
import FilterField from "../features/account/FilterField";
import SettingsModal from "../features/account/SettingsModal";
import styles from "./Account.module.css";

function formatReportDate(dateString) {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function getGroupDateLabel(dateString) {
  const [year, month, day] = dateString.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getUserLabel(reportCount, t) {
  if (reportCount >= 10) return t("account.activeContributor");
  if (reportCount >= 1) return t("account.roadReporter");
  return t("account.newMember");
}

function normalizeType(report) {
  const category = String(report?.category || "")
    .trim()
    .toLowerCase();
  const type = String(report?.type || "")
    .trim()
    .toLowerCase();
  const combined = `${category} ${type}`.trim();
  const normalizedCombined = `${combined} ${combined.replaceAll("_", " ")}`;

  if (
    normalizedCombined.includes("traffic jam") ||
    normalizedCombined.includes("active traffic jam") ||
    normalizedCombined.includes("jam") ||
    normalizedCombined.includes("congestion") ||
    category === "traffic jam"
  ) {
    return "Traffic Jam";
  }

  if (
    normalizedCombined.includes("collision") ||
    normalizedCombined.includes("crash") ||
    normalizedCombined.includes("accident")
  ) {
    return "Collision";
  }

  if (normalizedCombined.includes("pedestrian")) {
    return "Pedestrian";
  }

  if (normalizedCombined.includes("rollover")) {
    return "Rollover";
  }

  if (
    normalizedCombined.includes("roadwork") ||
    normalizedCombined.includes("road work")
  ) {
    return "Roadwork";
  }

  if (
    normalizedCombined.includes("public event") ||
    normalizedCombined.includes("event")
  ) {
    return "Public Event";
  }

  if (
    normalizedCombined.includes("road closure") ||
    normalizedCombined.includes("closure")
  ) {
    return "Road Closure";
  }

  if (normalizedCombined.includes("stalled vehicle")) {
    return "Stalled Vehicle";
  }

  if (normalizedCombined.includes("police checkpoint")) {
    return "Police Checkpoint";
  }

  if (normalizedCombined.includes("debris")) {
    return "Road Debris";
  }

  if (normalizedCombined.includes("flooding")) {
    return "Flooding";
  }

  return "Other";
}

function normalizeSeverity(report) {
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
    combined.includes("low severity") ||
    combined.includes("low") ||
    combined.includes("minor") ||
    combined.includes("light")
  ) {
    return "Low";
  }

  if (
    combined.includes("medium severity") ||
    combined.includes("medium") ||
    combined.includes("moderate") ||
    combined.includes("average")
  ) {
    return "Medium";
  }

  if (
    combined.includes("high severity") ||
    combined.includes("high") ||
    combined.includes("critical") ||
    combined.includes("serious") ||
    combined.includes("severe")
  ) {
    return "High";
  }

  if (
    combined.includes("traffic jam") ||
    combined.includes("jam") ||
    combined.includes("congestion")
  ) {
    return "Medium";
  }

  if (
    combined.includes("collision") ||
    combined.includes("accident") ||
    combined.includes("rollover")
  ) {
    return "High";
  }

  return "Low";
}

function getMarkStyle(report) {
  const type = report.normalizedType;
  const severity = report.normalizedSeverity;

  if (type === "Traffic Jam") {
    return {
      text: "#8b5cf6",
      bg: "#f5f3ff",
      iconBg: "#f5f3ff",
      iconColor: "#8b5cf6",
      badgeText: "Traffic Jam",
    };
  }

  if (severity === "High") {
    return {
      text: "#ef4444",
      bg: "#fef2f2",
      iconBg: "#fef2f2",
      iconColor: "#ef4444",
      badgeText: "High Severity",
    };
  }

  if (severity === "Medium") {
    return {
      text: "#f59e0b",
      bg: "#fff7ed",
      iconBg: "#fff7ed",
      iconColor: "#f59e0b",
      badgeText: "Medium Severity",
    };
  }

  return {
    text: "#3b82f6",
    bg: "#eff6ff",
    iconBg: "#eff6ff",
    iconColor: "#3b82f6",
    badgeText: "Low Severity",
  };
}

export default function Account() {
  const { t, tt, ts } = useI18n();
  const navigate = useNavigate();

  const currentUser = useAppStore((state) => state.currentUser);
  const removeTrafficReport = useAppStore((state) => state.removeTrafficReport);
  const signOut = useAppStore((state) => state.signOut);
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser);
  const saveCurrentUserProfile = useAppStore(
    (state) => state.saveCurrentUserProfile,
  );
  const changePassword = useAppStore((state) => state.changePassword);

  const [deletingId, setDeletingId] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState("All Types");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchAllReports = async () => {
      try {
        const reports = await getRawTrafficReports();
        const normalized = reports.map((report) => ({
          id: report.id,
          lat: report.lat,
          lng: report.lng,
          road: report.road || "",
          crossroad: report.crossroad || "",
          category: report.category,
          type: report.type || "",
          weather: report.weather || "",
          district: report.district || "",
          userName: report.user_name || "User",
          createdAt: report.created_at,
          normalizedType: normalizeType(report),
          normalizedSeverity: normalizeSeverity(report),
        }));
        setAllReports(normalized);
      } catch (error) {
        reportError("Error fetching all account reports:", error);
      }
    };

    fetchAllReports();
  }, []);

  const myReports = useMemo(() => {
    return allReports
      .filter((report) => {
        return (
          report.userName === currentUser?.full_name ||
          report.userName === currentUser?.name
        );
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [allReports, currentUser]);

  const filteredReports = useMemo(() => {
    return myReports.filter((report) => {
      const reportDate = new Date(report.createdAt);

      const matchesType =
        typeFilter === "All Types" || report.normalizedType === typeFilter;

      const matchesSeverity =
        severityFilter === "All Severities" ||
        report.normalizedSeverity === severityFilter;

      if (!matchesType || !matchesSeverity) return false;

      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (reportDate < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (reportDate > to) return false;
      }

      return true;
    });
  }, [myReports, typeFilter, severityFilter, fromDate, toDate]);

  const groupedReports = useMemo(() => {
    const groups = {};

    filteredReports.forEach((report) => {
      const date = new Date(report.createdAt);

      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      if (!groups[key]) groups[key] = [];
      groups[key].push(report);
    });

    return Object.entries(groups).sort(
      (a, b) => new Date(b[0]) - new Date(a[0]),
    );
  }, [filteredReports]);

  const reportCount = myReports.length;
  const userLabel = getUserLabel(reportCount, t);

  const userName =
    currentUser?.full_name || currentUser?.name || t("common.user");
  const userContact =
    currentUser?.email || currentUser?.phone || t("account.noContact");

  const typeOptions = [
    "All Types",
    "Traffic Jam",
    "Collision",
    "Pedestrian",
    "Rollover",
    "Roadwork",
    "Public Event",
    "Road Closure",
    "Stalled Vehicle",
    "Police Checkpoint",
    "Road Debris",
    "Flooding",
  ];

  const severityOptions = ["All Severities", "Low", "Medium", "High"];

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      const result = await removeTrafficReport(id);

      if (result?.ok) {
        setAllReports((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      reportError("Error deleting report:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const resetFilters = () => {
    setTypeFilter("All Types");
    setSeverityFilter("All Severities");
    setFromDate(null);
    setToDate(null);
  };

  return (
    <div>
      <Topbar titleKey="nav.account" />

      <div className={styles.accountStyle47}>
        <SectionCard>
          <div className={styles.accountStyle48}>
            <div className={styles.accountStyle49}>
              <div className={styles.accountStyle50}>
                <img
                  src={
                    currentUser?.avatar ||
                    "https://placehold.co/120x120/e5e7eb/64748b?text=User"
                  }
                  alt="User"
                  className={styles.accountStyle51}
                />
              </div>

              <div>
                <div className={styles.accountStyle52}>{userName}</div>

                <div className={styles.accountStyle53}>{userContact}</div>

                <div className={styles.accountStyle54}>
                  <div className={styles.accountStyle55}>
                    {t("account.totalReports", { count: reportCount })}
                  </div>

                  <div
                    style={{
                      background: reportCount >= 10 ? "#e8f0ff" : "#f3f4f6",
                      color: reportCount >= 10 ? "#2563eb" : "#64748b",
                      borderRadius: "14px",
                      padding: "10px 18px",
                      fontWeight: 700,
                    }}
                  >
                    {userLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.accountStyle56}>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className={styles.accountStyle57}
              >
                <Settings size={16} />
                {t("account.settings")}
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className={styles.accountStyle58}
              >
                <LogOut size={16} />
                {t("account.signOut")}
              </button>
            </div>
          </div>
        </SectionCard>

        <div className={styles.accountStyle59} />

        <SectionCard>
          <div className={styles.accountStyle60}>
            <div className={styles.accountStyle61}>
              <div>
                <div className={styles.accountStyle62}>
                  {t("account.myRecentMarks")}
                </div>

                <div className={styles.accountStyle63}>
                  {t("account.manageReports")}
                </div>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className={styles.accountStyle64}
              >
                {t("common.resetFilters")}
              </button>
            </div>
          </div>

          {myReports.length > 0 && (
            <div
              className={["account-filter-grid", styles.accountStyle65]
                .filter(Boolean)
                .join(" ")}
            >
              <FilterField label={t("common.type")}>
                <div className={styles.accountStyle66}>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={styles.accountStyle67}
                  >
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.startsWith("All")
                          ? t("filters.allTypes")
                          : tt(option)}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterField>

              <FilterField label={t("common.severity")}>
                <div className={styles.accountStyle68}>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className={styles.accountStyle69}
                  >
                    {severityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.startsWith("All")
                          ? t("filters.allSeverities")
                          : ts(option)}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterField>

              <FilterField label={t("account.fromDate")}>
                <div className={styles.accountStyle70}>
                  <DatePicker
                    selected={fromDate}
                    onChange={(date) => setFromDate(date)}
                    dateFormat="dd.MM.yyyy"
                    placeholderText="dd.mm.yyyy"
                    locale={enGB}
                    isClearable
                    wrapperClassName="account-datepicker-wrapper"
                    className="account-datepicker-input"
                    popperClassName="app-datepicker-popper"
                    calendarClassName="app-datepicker-calendar"
                    popperPlacement="bottom-start"
                    onKeyDown={(event) => event.preventDefault()}
                    onPaste={(event) => event.preventDefault()}
                  />
                </div>
              </FilterField>

              <FilterField label={t("account.toDate")}>
                <div className={styles.accountStyle71}>
                  <DatePicker
                    selected={toDate}
                    onChange={(date) => setToDate(date)}
                    dateFormat="dd.MM.yyyy"
                    placeholderText="dd.mm.yyyy"
                    locale={enGB}
                    isClearable
                    wrapperClassName="account-datepicker-wrapper"
                    className="account-datepicker-input"
                    popperClassName="app-datepicker-popper"
                    calendarClassName="app-datepicker-calendar"
                    popperPlacement="bottom-start"
                    onKeyDown={(event) => event.preventDefault()}
                    onPaste={(event) => event.preventDefault()}
                  />
                </div>
              </FilterField>
            </div>
          )}

          {groupedReports.length === 0 ? (
            <div className={styles.accountStyle72}>
              <div className={styles.accountStyle73}>
                <MapPin size={30} color="#8b5cf6" />
              </div>

              <div className={styles.accountStyle74}>
                {myReports.length === 0
                  ? t("account.noReportsYet")
                  : t("account.noReportsMatch")}
              </div>

              <button
                type="button"
                onClick={() => navigate("/")}
                className={styles.accountStyle75}
              >
                {t("common.goToMap")}
              </button>
            </div>
          ) : (
            <div className={styles.accountStyle76}>
              {groupedReports.map(([dateKey, reports]) => (
                <div key={dateKey} className={styles.accountStyle77}>
                  <div className={styles.accountStyle78}>
                    {getGroupDateLabel(dateKey)}
                  </div>

                  {reports.map((report) => {
                    const markStyle = getMarkStyle(report);

                    return (
                      <div key={report.id} className={styles.accountStyle79}>
                        <div className={styles.accountStyle80}>
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "14px",
                              background: markStyle.iconBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <MapPin size={18} color={markStyle.iconColor} />
                          </div>

                          <div className={styles.accountStyle81}>
                            <div className={styles.accountStyle82}>
                              <div className={styles.accountStyle83}>
                                {report.road || t("common.unknownRoad")}
                              </div>

                              <span className={styles.accountStyle84}>
                                {t("account.yourReport")}
                              </span>
                            </div>

                            <div className={styles.accountStyle85}>
                              {report.crossroad
                                ? `${report.crossroad} · ${formatReportDate(report.createdAt)}`
                                : formatReportDate(report.createdAt)}
                            </div>

                            <div
                              style={{
                                marginTop: "8px",
                                display: "inline-block",
                                background: markStyle.bg,
                                color: markStyle.text,
                                borderRadius: "999px",
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              {report.normalizedType === "Traffic Jam"
                                ? tt("Traffic Jam")
                                : ts(report.normalizedSeverity)}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(report.id)}
                          disabled={deletingId === report.id}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--text-soft)",
                            cursor: "pointer",
                            fontSize: "22px",
                            fontWeight: 700,
                            opacity: deletingId === report.id ? 0.5 : 1,
                          }}
                          title={t("account.deleteMark")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentUser={currentUser}
        updateCurrentUser={updateCurrentUser}
        saveCurrentUserProfile={saveCurrentUserProfile}
        changePassword={changePassword}
        myReports={myReports}
        t={t}
      />

      <style>{`
        .account-datepicker-wrapper {
          display: block;
          width: 100%;
        }

        .account-datepicker-wrapper .account-datepicker-input {
          width: 100%;
          height: 42px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--surface-soft);
          padding: 0 14px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          outline: none;
          box-sizing: border-box;
          min-width: 0;
        }

        .account-datepicker-wrapper .react-datepicker__close-icon {
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
      `}</style>
    </div>
  );
}
