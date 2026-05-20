import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  AlertTriangle,
  BarChart3,
  Cloud,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "../components/UI/icons";
import SectionCard from "../components/UI/SectionCard";
import Topbar from "../components/UI/Topbar";
import { useI18n } from "../i18n";
import { getRawRealAccidents } from "../services/accidentsService";
import { getRawTrafficReports } from "../services/trafficReportsService";
import useDistrictsGeojson from "../hooks/useDistrictsGeojson";
import { reportError } from "../utils/logger";
import {
  buildDistrictPassport,
  DISTRICT_ORDER,
  formatDistrictName,
  getAvailableYears,
} from "../features/analytics/cityInsights";
import styles from "./DistrictPassport.module.css";

const recommendationKeyByLabel = {
  "усилить контроль": "increaseControl",
  "проверить светофор": "checkTrafficLight",
  "добавить предупреждающие знаки": "addSigns",
};

const weatherKeyByLabel = {
  Ясно: "clear",
  Дождь: "rain",
  Гололед: "ice",
  Снег: "snow",
  Туман: "fog",
  Гроза: "storm",
  Облачно: "cloudy",
  Неизвестно: "unknown",
};

function formatLocalizedDistrictName(value, t) {
  const key = value || "Unknown";
  const translated = t(`districtName.${key}`);
  return translated === `districtName.${key}`
    ? formatDistrictName(value)
    : translated;
}

function formatRecommendation(value, t) {
  const key = recommendationKeyByLabel[value] || "addSigns";
  return t(`recommendationText.${key}`);
}

function formatWeatherFactor(value, t) {
  const key = weatherKeyByLabel[value] || "unknown";
  return t(`weather.${key}`);
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

function Metric({ icon, label, value, color }) {
  return (
    <div className={styles.metric}>
      <div
        className={styles.metricIcon}
        style={{
          color,
          background: `${color}14`,
        }}
      >
        {icon({ size: 18 })}
      </div>
      <div>
        <div className={styles.metricLabel}>{label}</div>
        <div className={styles.metricValue}>{value}</div>
      </div>
    </div>
  );
}

function RankedItem({ item, index, t }) {
  return (
    <div className={styles.rankedItem}>
      <div className={styles.rank}>{index + 1}</div>
      <div className={styles.rankBody}>
        <strong>{item.label}</strong>
        <span>{t("districtPassport.cases", { count: item.count })}</span>
      </div>
    </div>
  );
}

export default function DistrictPassport() {
  const { t } = useI18n();
  const districtsGeojson = useDistrictsGeojson();
  const [accidents, setAccidents] = useState([]);
  const [trafficReports, setTrafficReports] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState("Esil");
  const [selectedYear, setSelectedYear] = useState("all");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accidentData, trafficData] = await Promise.all([
        getRawRealAccidents(10000),
        getRawTrafficReports(),
      ]);
      setAccidents(accidentData);
      setTrafficReports(trafficData);
    } catch (error) {
      reportError("Failed to load district passport:", error);
      setAccidents([]);
      setTrafficReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const years = useMemo(
    () => getAvailableYears(accidents, trafficReports),
    [accidents, trafficReports],
  );

  const passport = useMemo(
    () =>
      buildDistrictPassport(
        selectedDistrict,
        selectedYear,
        accidents,
        trafficReports,
        districtsGeojson,
      ),
    [accidents, districtsGeojson, selectedDistrict, selectedYear, trafficReports],
  );

  const hourlyData = useMemo(
    () => ({
      labels: Array.from({ length: 24 }, (_, index) => `${index}:00`),
      datasets: [
        {
          label: t("districtPassport.activity"),
          data: passport.hourly,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2.5,
        },
      ],
    }),
    [passport.hourly, t],
  );

  const chartOptions = {
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
        grid: { display: false },
        ticks: {
          color: "#94a3b8",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(148,163,184,0.15)",
        },
        ticks: {
          color: "#94a3b8",
          precision: 0,
        },
        border: { display: false },
      },
    },
  };

  return (
    <div>
      <Topbar titleKey="nav.districtPassport" />

      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>DISTRICT PROFILE</div>
          <h1>{t("districtPassport.title")}</h1>
          <p>{t("districtPassport.description")}</p>
          <div className={styles.sourceNote}>{t("districtPassport.sourceNote")}</div>
        </div>

        <button type="button" onClick={loadData} className={styles.refresh}>
          <RefreshCw size={17} />
          {loading ? t("districtPassport.updating") : t("districtPassport.refresh")}
        </button>
      </div>

      <SectionCard className={styles.controlsCard}>
        <div className={styles.controls}>
          <div>
            <div className={styles.controlLabel}>{t("districtPassport.district")}</div>
            <div className={styles.districtTabs}>
              {DISTRICT_ORDER.map((district) => (
                <button
                  key={district}
                  type="button"
                  onClick={() => setSelectedDistrict(district)}
                  className={[
                    styles.districtTab,
                    selectedDistrict === district ? styles.districtTabActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {formatLocalizedDistrictName(district, t)}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.periodSelect}>
            <span>{t("districtPassport.period")}</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              <option value="all">{t("districtPassport.allYears")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <div className={styles.metrics}>
        <Metric icon={AlertTriangle} label={t("districtPassport.accidents")} value={passport.accidents} color="#dc2626" />
        <Metric icon={MapPin} label={t("districtPassport.traffic")} value={passport.traffic} color="#8b5cf6" />
        <Metric icon={BarChart3} label={t("districtPassport.peakHour")} value={passport.peakHour} color="#2563eb" />
        <Metric icon={ShieldCheck} label={t("districtPassport.recommendation")} value={formatRecommendation(passport.recommendation, t)} color="#16a34a" />
      </div>

      <div className={styles.contentGrid}>
        <SectionCard className={styles.profileCard}>
          <div className={styles.profileHeader}>
            <div>
              <div className={styles.profileKicker}>{t("districtPassport.profileCard")}</div>
              <h2>{formatLocalizedDistrictName(selectedDistrict, t)}</h2>
            </div>
            <div className={styles.riskPill}>
              {passport.total >= 30
                ? t("riskLevel.highRisk")
                : t("riskLevel.moderate")}
            </div>
          </div>

          <div className={styles.recommendationBox}>
            <ShieldCheck size={22} />
            <div>
              <strong>
                {t("districtPassport.recommendationPrefix", {
                  value: formatRecommendation(passport.recommendation, t),
                })}
              </strong>
              <p>{t("districtPassport.recommendationBody")}</p>
            </div>
          </div>

          <div className={styles.chartHeader}>
            <div>
              <h3>{t("districtPassport.hourlyChart")}</h3>
              <p>{t("districtPassport.hourlySubtitle")}</p>
            </div>
          </div>

          <div className={styles.chartWrap}>
            <Line data={hourlyData} options={chartOptions} />
          </div>
        </SectionCard>

        <div className={styles.sideStack}>
          <SectionCard>
            <div className={styles.sideHeader}>
              <MapPin size={20} color="var(--primary)" />
              <h2>{t("districtPassport.dangerousStreets")}</h2>
            </div>

            {passport.topRoads.length === 0 ? (
              <div className={styles.emptyMini}>{t("districtPassport.noStreetData")}</div>
            ) : (
              <div className={styles.rankList}>
                {passport.topRoads.map((item, index) => (
                  <RankedItem key={item.label} item={item} index={index} t={t} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <div className={styles.sideHeader}>
              <Cloud size={20} color="#10b981" />
              <h2>{t("districtPassport.weatherFactors")}</h2>
            </div>

            {passport.weatherFactors.length === 0 ? (
              <div className={styles.emptyMini}>{t("districtPassport.noWeatherFactors")}</div>
            ) : (
              <div className={styles.weatherList}>
                {passport.weatherFactors.map((item) => (
                  <div key={item.label} className={styles.weatherItem}>
                    <span>{formatWeatherFactor(item.label, t)}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
