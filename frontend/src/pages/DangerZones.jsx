import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import {
  AlertTriangle,
  BarChart3,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from "../components/UI/icons";
import SectionCard from "../components/UI/SectionCard";
import Topbar from "../components/UI/Topbar";
import { useI18n } from "../i18n";
import { getRawRealAccidents } from "../services/accidentsService";
import { getRawTrafficReports } from "../services/trafficReportsService";
import useDistrictsGeojson from "../hooks/useDistrictsGeojson";
import { reportError } from "../utils/logger";
import {
  buildDangerZones,
  formatDistrictName,
} from "../features/analytics/cityInsights";
import styles from "./DangerZones.module.css";

function getRiskKey(level) {
  if (level === "Критический") return "critical";
  if (level === "Высокий") return "high";
  return "medium";
}

function getRiskLabel(level, t) {
  return t(`riskLevel.${getRiskKey(level)}`);
}

function formatLocalizedDistrictName(value, t) {
  const key = value || "Unknown";
  const translated = t(`districtName.${key}`);
  return translated === `districtName.${key}`
    ? formatDistrictName(value)
    : translated;
}

function createRiskIcon(zone, selected) {
  const riskKey = getRiskKey(zone.riskLevel);
  const color =
    riskKey === "critical"
      ? "#dc2626"
      : riskKey === "high"
        ? "#f97316"
        : "#2563eb";

  return L.divIcon({
    className: "danger-zone-marker",
    html: `
      <div class="danger-zone-marker__ring" style="border-color:${color}; opacity:${selected ? 0.38 : 0.2};"></div>
      <div class="danger-zone-marker__core" style="background:${color};">${zone.accidents + zone.traffic}</div>
    `,
    iconSize: selected ? [54, 54] : [46, 46],
    iconAnchor: selected ? [27, 27] : [23, 23],
    popupAnchor: [0, -24],
  });
}

function FocusZone({ zone }) {
  const map = useMap();

  useEffect(() => {
    if (!zone) return;

    map.flyTo([zone.lat, zone.lng], 14, {
      duration: 0.8,
    });
  }, [map, zone]);

  return null;
}

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

function RiskBadge({ level, t }) {
  const riskKey = getRiskKey(level);
  const color =
    riskKey === "critical"
      ? "#dc2626"
      : riskKey === "high"
        ? "#f97316"
        : "#2563eb";

  return (
    <span
      className={styles.riskBadge}
      style={{
        background: `${color}14`,
        color,
      }}
    >
      {getRiskLabel(level, t)}
    </span>
  );
}

export default function DangerZones() {
  const { t } = useI18n();
  const districtsGeojson = useDistrictsGeojson();
  const [accidents, setAccidents] = useState([]);
  const [trafficReports, setTrafficReports] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
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
      reportError("Failed to load danger zones:", error);
      setAccidents([]);
      setTrafficReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const zones = useMemo(
    () => buildDangerZones(accidents, trafficReports, districtsGeojson),
    [accidents, trafficReports, districtsGeojson],
  );

  const selectedZone = useMemo(() => {
    return zones.find((zone) => zone.key === selectedKey) || zones[0] || null;
  }, [selectedKey, zones]);

  const metrics = useMemo(() => {
    const accidentCount = zones.reduce((sum, zone) => sum + zone.accidents, 0);
    const trafficCount = zones.reduce((sum, zone) => sum + zone.traffic, 0);
    const criticalCount = zones.filter(
      (zone) => getRiskKey(zone.riskLevel) === "critical",
    ).length;

    return {
      zones: zones.length,
      accidentCount,
      trafficCount,
      criticalCount,
    };
  }, [zones]);

  return (
    <div>
      <Topbar titleKey="nav.dangerZones" />

      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>RISK TOP-10</div>
          <h1>{t("dangerZones.title")}</h1>
          <p>{t("dangerZones.description")}</p>
          <div className={styles.sourceNote}>{t("dangerZones.sourceNote")}</div>
        </div>

        <button type="button" onClick={loadData} className={styles.refresh}>
          <RefreshCw size={17} />
          {loading ? t("dangerZones.updating") : t("dangerZones.refresh")}
        </button>
      </div>

      <div className={styles.metrics}>
        <Metric icon={ShieldAlert} label={t("dangerZones.topZones")} value={metrics.zones} color="#dc2626" />
        <Metric icon={AlertTriangle} label={t("dangerZones.accidentsTop10")} value={metrics.accidentCount} color="#f97316" />
        <Metric icon={MapPin} label={t("dangerZones.trafficTop10")} value={metrics.trafficCount} color="#8b5cf6" />
        <Metric icon={BarChart3} label={t("dangerZones.criticalZones")} value={metrics.criticalCount} color="#2563eb" />
      </div>

      <div className={styles.contentGrid}>
        <SectionCard className={styles.mapCard}>
          <div className={styles.mapHeader}>
            <div>
              <h2>{t("dangerZones.mapTitle")}</h2>
              <p>{t("dangerZones.mapSubtitle")}</p>
            </div>
            {selectedZone ? <RiskBadge level={selectedZone.riskLevel} t={t} /> : null}
          </div>

          <div className={styles.mapWrap}>
            <MapContainer
              center={[selectedZone?.lat || 51.1694, selectedZone?.lng || 71.4491]}
              zoom={12}
              className={styles.map}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FocusZone zone={selectedZone} />

              {zones.map((zone) => (
                <Marker
                  key={zone.key}
                  position={[zone.lat, zone.lng]}
                  icon={createRiskIcon(zone, zone.key === selectedZone?.key)}
                  eventHandlers={{
                    click: () => setSelectedKey(zone.key),
                  }}
                >
                  <Popup>
                    <div className={styles.popup}>
                      <strong>{zone.label}</strong>
                      <span>{formatLocalizedDistrictName(zone.district, t)}</span>
                      <span>{t("dangerZones.accidentShort")}: {zone.accidents}</span>
                      <span>{t("dangerZones.trafficShort")}: {zone.traffic}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <div className={styles.tableHeader}>
            <div>
              <h2>{t("dangerZones.topTitle")}</h2>
              <p>{t("dangerZones.topSubtitle")}</p>
            </div>
          </div>

          <div className={styles.zoneList}>
            {zones.length === 0 ? (
              <div className={styles.emptyState}>
                <AlertTriangle size={30} color="#94a3b8" />
                <strong>{t("dangerZones.loadingTitle")}</strong>
                <span>{t("dangerZones.loadingHint")}</span>
              </div>
            ) : (
              zones.map((zone, index) => {
                const selected = zone.key === selectedZone?.key;

                return (
                  <article
                    key={zone.key}
                    className={[
                      styles.zoneRow,
                      selected ? styles.zoneRowActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className={styles.rank}>{index + 1}</div>
                    <div className={styles.zoneBody}>
                      <div className={styles.zoneTitle}>{zone.label}</div>
                      <div className={styles.zoneDistrict}>
                        {formatLocalizedDistrictName(zone.district, t)}
                      </div>

                      <div className={styles.zoneStats}>
                        <span>{t("dangerZones.accidentShort")}: {zone.accidents}</span>
                        <span>{t("dangerZones.trafficShort")}: {zone.traffic}</span>
                        <span>{t("dangerZones.peakShort")}: {zone.peakTime}</span>
                      </div>
                    </div>
                    <div className={styles.zoneActions}>
                      <RiskBadge level={zone.riskLevel} t={t} />
                      <button
                        type="button"
                        onClick={() => setSelectedKey(zone.key)}
                      >
                        <MapPin size={15} />
                        {t("dangerZones.showOnMap")}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
