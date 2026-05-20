import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import {
  AlertTriangle,
  Check,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from "../components/UI/icons";
import SectionCard from "../components/UI/SectionCard";
import Topbar from "../components/UI/Topbar";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import styles from "./MySos.module.css";

const dateLocales = {
  en: "en-GB",
  ru: "ru-RU",
  kz: "kk-KZ",
};

const statusMeta = {
  new: {
    labelKey: "sosStatus.new",
    color: "#dc2626",
    bg: "#fef2f2",
    step: 1,
  },
  accepted: {
    labelKey: "sosStatus.accepted",
    color: "#f97316",
    bg: "#fff7ed",
    step: 2,
  },
  dispatched: {
    labelKey: "sosStatus.dispatched",
    color: "#2563eb",
    bg: "#eff6ff",
    step: 3,
  },
  resolved: {
    labelKey: "sosStatus.resolved",
    color: "#16a34a",
    bg: "#f0fdf4",
    step: 4,
  },
  cancelled: {
    labelKey: "sosStatus.cancelled",
    color: "#64748b",
    bg: "#f8fafc",
    step: 0,
  },
};

const steps = ["new", "accepted", "dispatched", "resolved"];

function getStatusMeta(status) {
  return statusMeta[status] || statusMeta.new;
}

function formatDateTime(value, language) {
  if (!value) return "--";

  return new Date(value).toLocaleString(dateLocales[language] || dateLocales.ru, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCoords(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return "--";
  }

  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function getIncidentTypeLabel(value, t) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "road accident") {
    return t("mySos.roadAccident");
  }

  return value;
}

function createMiniIcon(status) {
  const meta = getStatusMeta(status);

  return L.divIcon({
    className: "sos-mini-marker",
    html: `<div class="sos-mini-marker__dot" style="background:${meta.color};"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function matchesCurrentUser(incident, user) {
  if (!user) return false;

  const userEmail = String(user.email || "").toLowerCase();
  const userPhone = String(user.phone || "").replace(/\D/g, "");
  const userName = String(user.full_name || user.name || "").toLowerCase();
  const reporterEmail = String(incident.reporterEmail || "").toLowerCase();
  const reporterPhone = String(incident.reporterPhone || "").replace(/\D/g, "");
  const reporterName = String(incident.reporterName || "").toLowerCase();

  return (
    (!!userEmail && userEmail === reporterEmail) ||
    (!!userPhone && userPhone === reporterPhone) ||
    (!!userName && userName === reporterName)
  );
}

function StatusBadge({ status, t }) {
  const meta = getStatusMeta(status);

  return (
    <span
      className={styles.statusBadge}
      style={{
        background: meta.bg,
        color: meta.color,
      }}
    >
      {t(meta.labelKey)}
    </span>
  );
}

function ProgressSteps({ status, t }) {
  const currentStep = getStatusMeta(status).step;

  return (
    <div className={styles.progressSteps}>
      {steps.map((stepKey, index) => {
        const active = currentStep >= index + 1;

        return (
          <div
            key={stepKey}
            className={[
              styles.progressStep,
              active ? styles.progressStepActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{index + 1}</span>
            <strong>{t(`sosStatus.${stepKey}`)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function SosCard({ incident, language, t }) {
  const meta = getStatusMeta(incident.status);
  const position = [incident.lat, incident.lng];

  return (
    <article className={styles.sosCard}>
      <div className={styles.cardMain}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.ticket}>{incident.ticket}</div>
            <div className={styles.location}>
              {incident.road || t("mySos.unknownRoad")}
              {incident.crossroad ? ` · ${incident.crossroad}` : ""}
            </div>
          </div>
          <StatusBadge status={incident.status} t={t} />
        </div>

        <div className={styles.detailGrid}>
          <div>
            <span>{t("mySos.time")}</span>
            <strong>{formatDateTime(incident.createdAt, language)}</strong>
          </div>
          <div>
            <span>{t("mySos.district")}</span>
            <strong>{incident.district || t("mySos.undefinedDistrict")}</strong>
          </div>
          <div>
            <span>{t("mySos.coordinates")}</span>
            <strong>{formatCoords(incident.lat, incident.lng)}</strong>
          </div>
          <div>
            <span>{t("mySos.type")}</span>
            <strong>{getIncidentTypeLabel(incident.incidentType, t)}</strong>
          </div>
        </div>

        <ProgressSteps status={incident.status} t={t} />

        {incident.description ? (
          <p className={styles.description}>{incident.description}</p>
        ) : null}
      </div>

      <div className={styles.miniMap}>
        <MapContainer
          center={position}
          zoom={14}
          dragging={false}
          zoomControl={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          attributionControl={false}
          className={styles.map}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={position} icon={createMiniIcon(incident.status)} />
        </MapContainer>

        <div
          className={styles.mapStatus}
          style={{
            color: meta.color,
            background: meta.bg,
          }}
        >
          <MapPin size={14} />
          {t("mySos.onMap")}
        </div>
      </div>
    </article>
  );
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

export default function MySos() {
  const { language, t } = useI18n();
  const currentUser = useAppStore((state) => state.currentUser);
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const sosIncidents = useAppStore((state) => state.sosIncidents);
  const fetchSosIncidents = useAppStore((state) => state.fetchSosIncidents);
  const [loading, setLoading] = useState(false);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    await fetchSosIncidents({ activeOnly: false });
    setLoading(false);
  }, [fetchSosIncidents]);

  useEffect(() => {
    if (currentUser) {
      const timer = window.setTimeout(() => {
        loadIncidents();
      }, 0);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [currentUser, loadIncidents]);

  const myIncidents = useMemo(() => {
    return sosIncidents
      .filter((incident) => matchesCurrentUser(incident, currentUser))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [currentUser, sosIncidents]);

  const metrics = useMemo(() => {
    return {
      total: myIncidents.length,
      active: myIncidents.filter((item) =>
        ["new", "accepted", "dispatched"].includes(item.status),
      ).length,
      dispatched: myIncidents.filter((item) => item.status === "dispatched")
        .length,
      resolved: myIncidents.filter((item) => item.status === "resolved")
        .length,
    };
  }, [myIncidents]);

  if (!currentUser) {
    return (
      <div>
        <Topbar titleKey="nav.mySos" showTrafficAction={false} />
        <SectionCard>
          <div className={styles.accessState}>
            <div className={styles.accessIcon}>
              <ShieldAlert size={34} />
            </div>
            <div>
              <h1>{t("mySos.signInTitle")}</h1>
              <p>{t("mySos.signInText")}</p>
              <button type="button" onClick={openAuthModal}>
                {t("mySos.signInAction")}
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <Topbar titleKey="nav.mySos" showTrafficAction={false} />

      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>{t("mySos.kicker")}</div>
          <h1>{t("mySos.title")}</h1>
          <p>{t("mySos.description")}</p>
        </div>

        <button type="button" onClick={loadIncidents} className={styles.refresh}>
          <RefreshCw size={17} />
          {loading ? t("mySos.updating") : t("mySos.refresh")}
        </button>
      </div>

      <div className={styles.metrics}>
        <Metric icon={ShieldAlert} label={t("mySos.totalSos")} value={metrics.total} color="#dc2626" />
        <Metric icon={AlertTriangle} label={t("mySos.active")} value={metrics.active} color="#f97316" />
        <Metric icon={MapPin} label={t("mySos.serviceDispatched")} value={metrics.dispatched} color="#2563eb" />
        <Metric icon={Check} label={t("mySos.completed")} value={metrics.resolved} color="#16a34a" />
      </div>

      <SectionCard>
        <div className={styles.listHeader}>
          <div>
            <h2>{t("mySos.sentSignals")}</h2>
            <p>{t("mySos.linkedRequests", { count: myIncidents.length })}</p>
          </div>
          <div className={styles.liveChip}>
            <Clock3 size={14} />
            {t("mySos.liveStatus")}
          </div>
        </div>

        {myIncidents.length === 0 ? (
          <div className={styles.emptyState}>
            <ShieldAlert size={32} color="#94a3b8" />
            <strong>{t("mySos.noSignalsTitle")}</strong>
            <span>{t("mySos.noSignalsText")}</span>
          </div>
        ) : (
          <div className={styles.sosList}>
            {myIncidents.map((incident) => (
              <SosCard key={incident.id} incident={incident} language={language} t={t} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
