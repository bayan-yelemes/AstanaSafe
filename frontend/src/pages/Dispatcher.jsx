import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import {
  AlertTriangle,
  Check,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
} from "../components/UI/icons";
import Topbar from "../components/UI/Topbar";
import SectionCard from "../components/UI/SectionCard";
import { useSosCall } from "../features/sosCall/SosCallContext";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import styles from "./Dispatcher.module.css";

const dateLocales = {
  en: "en-GB",
  ru: "ru-RU",
  kz: "kk-KZ",
};

const statusMeta = {
  new: {
    labelKey: "dispatcherPage.newSignal",
    color: "#dc2626",
    bg: "#fef2f2",
  },
  accepted: {
    labelKey: "sosStatus.accepted",
    color: "#f97316",
    bg: "#fff7ed",
  },
  dispatched: {
    labelKey: "sosStatus.dispatched",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  resolved: {
    labelKey: "sosStatus.resolved",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  cancelled: {
    labelKey: "sosStatus.cancelled",
    color: "#64748b",
    bg: "#f8fafc",
  },
};

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

function getStatusMeta(status) {
  return statusMeta[status] || statusMeta.new;
}

function createSosIcon(status) {
  const meta = getStatusMeta(status);

  return L.divIcon({
    className: "sos-dispatch-marker",
    html: `
      <div class="sos-dispatch-marker__pulse" style="border-color:${meta.color};"></div>
      <div class="sos-dispatch-marker__core" style="background:${meta.color};"></div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function FocusIncident({ incident }) {
  const map = useMap();

  useEffect(() => {
    if (!incident) return;

    map.flyTo([incident.lat, incident.lng], 15, {
      duration: 0.8,
    });
  }, [incident, map]);

  return null;
}

function MetricTile({ label, value, icon, color }) {
  return (
    <div className={styles.metricTileStyle}>
      <div
        style={{
          ...metricIconStyle,
          color,
          background: `${color}14`,
        }}
      >
        {createElement(icon, { size: 18 })}
      </div>
      <div>
        <div className={styles.metricLabelStyle}>{label}</div>
        <div className={styles.metricValueStyle}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status, t }) {
  const meta = getStatusMeta(status);

  return (
    <div
      style={{
        ...statusBadgeStyle,
        background: meta.bg,
        color: meta.color,
      }}
    >
      {t(meta.labelKey)}
    </div>
  );
}

function DispatchCard({
  incident,
  selected,
  onSelect,
  onCallDriver,
  onStatusChange,
  callOnline,
  callState,
  activeCallIncidentId,
  language,
  t,
}) {
  const meta = getStatusMeta(incident.status);
  const canAccept = incident.status === "new";
  const canDispatch = incident.status === "accepted";
  const canResolve =
    incident.status !== "resolved" && incident.status !== "cancelled";
  const canCallDriver = ["new", "accepted", "dispatched"].includes(
    incident.status,
  );
  const isCallingThisIncident =
    activeCallIncidentId === incident.id &&
    ["ringing", "connecting", "active"].includes(callState);
  const callButtonLabel =
    callState === "active" && isCallingThisIncident
      ? t("dispatcherPage.onCall")
      : isCallingThisIncident
        ? t("dispatcherPage.calling")
        : t("dispatcherPage.callDriver");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(incident)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(incident);
        }
      }}
      style={{
        ...dispatchCardStyle,
        borderColor: selected ? meta.color : "var(--border)",
        boxShadow: selected ? `0 18px 36px ${meta.color}20` : "none",
      }}
    >
      <div className={styles.dispatchHeaderStyle}>
        <div className={styles.dispatcherStyle1}>
          <div className={styles.ticketStyle}>{incident.ticket}</div>
          <div className={styles.placeStyle}>
            {incident.road || t("dispatcherPage.unknownRoad")}
            {incident.crossroad ? ` · ${incident.crossroad}` : ""}
          </div>
        </div>
        <StatusBadge status={incident.status} t={t} />
      </div>

      <div className={styles.detailGridStyle}>
        <div>
          <span className={styles.detailLabelStyle}>{t("dispatcherPage.time")}</span>
          <strong>{formatDateTime(incident.createdAt, language)}</strong>
        </div>
        <div>
          <span className={styles.detailLabelStyle}>{t("dispatcherPage.district")}</span>
          <strong>{incident.district || t("dispatcherPage.unknownDistrict")}</strong>
        </div>
        <div>
          <span className={styles.detailLabelStyle}>{t("dispatcherPage.coordinates")}</span>
          <strong>{formatCoords(incident.lat, incident.lng)}</strong>
        </div>
        <div>
          <span className={styles.detailLabelStyle}>{t("dispatcherPage.urgency")}</span>
          <strong className={styles.dispatcherStyle2}>{t("dispatcherPage.critical")}</strong>
        </div>
      </div>

      <div
        onClick={(event) => event.stopPropagation()}
        className={styles.buttonRowStyle}
      >
        {canCallDriver ? (
          <button
            type="button"
            onClick={() => onCallDriver(incident)}
            disabled={
              !callOnline ||
              (["incoming", "ringing", "connecting", "active"].includes(
                callState,
              ) &&
                !isCallingThisIncident)
            }
            className={[
              styles.smallActionButtonStyle,
              styles.callActionButton,
              isCallingThisIncident ? styles.callActionButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={t("sosCall.callDriverTitle")}
          >
            <Phone size={14} />
            {callButtonLabel}
          </button>
        ) : null}
        {canAccept ? (
          <button
            type="button"
            onClick={() => onStatusChange(incident.id, "accepted")}
            className={styles.smallActionButtonStyle}
          >
            {t("dispatcherPage.accept")}
          </button>
        ) : null}
        {canDispatch ? (
          <button
            type="button"
            onClick={() => onStatusChange(incident.id, "dispatched")}
            className={styles.smallActionButtonStyle}
          >
            {t("dispatcherPage.dispatchService")}
          </button>
        ) : null}
        {canResolve ? (
          <button
            type="button"
            onClick={() => onStatusChange(incident.id, "resolved")}
            className={[
              styles.smallActionButtonStyle,
              styles.resolveActionButton,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t("dispatcherPage.resolve")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Dispatcher() {
  const { language, t } = useI18n();
  const {
    activeCall,
    callState,
    socketState,
    startDispatcherCall,
  } = useSosCall();
  const currentUser = useAppStore((state) => state.currentUser);
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const sosIncidents = useAppStore((state) => state.sosIncidents);
  const fetchSosIncidents = useAppStore((state) => state.fetchSosIncidents);
  const updateSosIncidentStatus = useAppStore(
    (state) => state.updateSosIncidentStatus,
  );

  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasDispatcherAccess =
    currentUser?.role === "dispatcher" || currentUser?.role === "admin";

  const loadIncidents = useCallback(async () => {
    setRefreshing(true);
    await fetchSosIncidents({ activeOnly: false });
    setRefreshing(false);
  }, [fetchSosIncidents]);

  useEffect(() => {
    if (!hasDispatcherAccess) return;

    const initialTimer = window.setTimeout(() => {
      loadIncidents();
    }, 0);

    const timer = window.setInterval(() => {
      fetchSosIncidents({ activeOnly: false });
    }, 5000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [fetchSosIncidents, hasDispatcherAccess, loadIncidents]);

  const selectedIncident = useMemo(() => {
    return sosIncidents.find((item) => item.id === selectedIncidentId) || null;
  }, [sosIncidents, selectedIncidentId]);

  const activeIncidents = useMemo(() => {
    return sosIncidents.filter((item) =>
      ["new", "accepted", "dispatched"].includes(item.status),
    );
  }, [sosIncidents]);

  const sortedIncidents = useMemo(() => {
    return [...sosIncidents].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [sosIncidents]);

  const metrics = useMemo(() => {
    return {
      active: activeIncidents.length,
      fresh: sosIncidents.filter((item) => item.status === "new").length,
      dispatched: sosIncidents.filter((item) => item.status === "dispatched")
        .length,
      resolved: sosIncidents.filter((item) => item.status === "resolved")
        .length,
    };
  }, [activeIncidents.length, sosIncidents]);

  const handleStatusChange = async (id, status) => {
    const result = await updateSosIncidentStatus(id, status);

    if (result.ok) {
      setSelectedIncidentId(result.incident.id);
    }
  };

  if (!hasDispatcherAccess) {
    return (
      <div>
        <Topbar
          titleKey="nav.dispatcher"
          showTrafficAction={false}
          showEmergencyAction={false}
        />

        <SectionCard>
          <div className={styles.accessDenied}>
            <div className={styles.accessIcon}>
              <ShieldAlert size={34} />
            </div>
            <div>
              <div className={styles.accessTitle}>{t("dispatcherPage.accessTitle")}</div>
              <p className={styles.accessText}>{t("dispatcherPage.accessText")}</p>
              {!currentUser ? (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className={styles.accessButton}
                >
                  {t("dispatcherPage.signInAction")}
                </button>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        titleKey="nav.dispatcher"
        showTrafficAction={false}
        showEmergencyAction={false}
      />

      <div className={styles.pageHeaderStyle}>
        <div>
          <div className={styles.kickerStyle}>{t("dispatcherPage.kicker")}</div>
          <h1 className={styles.h1Style}>{t("dispatcherPage.title")}</h1>
          <p className={styles.leadStyle}>{t("dispatcherPage.lead")}</p>
        </div>

        <button
          type="button"
          onClick={loadIncidents}
          className={styles.refreshButtonStyle}
        >
          <RefreshCw size={17} />
          {refreshing ? t("dispatcherPage.updating") : t("dispatcherPage.refresh")}
        </button>
      </div>

      <div
        className={["dispatcher-metric-grid", styles.metricGridStyle]
          .filter(Boolean)
          .join(" ")}
      >
        <MetricTile
          label={t("dispatcherPage.activeSos")}
          value={metrics.active}
          icon={ShieldAlert}
          color="#dc2626"
        />
        <MetricTile
          label={t("dispatcherPage.newSignals")}
          value={metrics.fresh}
          icon={AlertTriangle}
          color="#f97316"
        />
        <MetricTile
          label={t("dispatcherPage.serviceDispatched")}
          value={metrics.dispatched}
          icon={MapPin}
          color="#2563eb"
        />
        <MetricTile
          label={t("dispatcherPage.completed")}
          value={metrics.resolved}
          icon={Check}
          color="#16a34a"
        />
      </div>

      <div
        className={["dispatcher-content-grid", styles.contentGridStyle]
          .filter(Boolean)
          .join(" ")}
      >
        <SectionCard className={styles.dispatcherStyle3}>
          <div className={styles.mapHeaderStyle}>
            <div>
              <div className={styles.sectionTitleStyle}>
                {t("dispatcherPage.mapTitle")}
              </div>
              <div className={styles.sectionSubtitleStyle}>
                {t("dispatcherPage.mapSubtitle")}
              </div>
            </div>
            <div className={styles.liveBadgeStyle}>{t("dispatcherPage.liveBadge")}</div>
          </div>

          <div className={styles.mapWrapStyle}>
            <MapContainer
              center={[51.1694, 71.4491]}
              zoom={12}
              className={styles.dispatcherStyle4}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FocusIncident incident={selectedIncident} />

              {activeIncidents.map((incident) => (
                <Marker
                  key={incident.id}
                  position={[incident.lat, incident.lng]}
                  icon={createSosIcon(incident.status)}
                  eventHandlers={{
                    click: () => setSelectedIncidentId(incident.id),
                  }}
                >
                  <Popup>
                    <div className={styles.dispatcherStyle5}>
                      <div className={styles.dispatcherStyle6}>
                        {incident.ticket}
                      </div>
                      <div>{incident.road || t("dispatcherPage.unknownRoad")}</div>
                      {incident.crossroad ? (
                        <div>{incident.crossroad}</div>
                      ) : null}
                      <div className={styles.dispatcherStyle7}>
                        {formatCoords(incident.lat, incident.lng)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <div className={styles.queueHeaderStyle}>
            <div>
              <div className={styles.sectionTitleStyle}>
                {t("dispatcherPage.queueTitle")}
              </div>
              <div className={styles.sectionSubtitleStyle}>
                {t("dispatcherPage.queueCount", { count: sortedIncidents.length })}
              </div>
            </div>
          </div>

          <div className={styles.queueListStyle}>
            {sortedIncidents.length === 0 ? (
              <div className={styles.emptyStateStyle}>
                <ShieldAlert size={30} color="#94a3b8" />
                <div>{t("dispatcherPage.empty")}</div>
              </div>
            ) : (
              sortedIncidents.map((incident) => (
                <DispatchCard
                  key={incident.id}
                  incident={incident}
                  selected={incident.id === selectedIncidentId}
                  onSelect={(item) => setSelectedIncidentId(item.id)}
                  onCallDriver={startDispatcherCall}
                  onStatusChange={handleStatusChange}
                  callOnline={socketState === "online"}
                  callState={callState}
                  activeCallIncidentId={activeCall?.incidentId}
                  language={language}
                  t={t}
                />
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

const metricIconStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const dispatchCardStyle = {
  width: "100%",
  textAlign: "left",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  borderRadius: 18,
  padding: 15,
  cursor: "pointer",
};

const statusBadgeStyle = {
  borderRadius: 999,
  padding: "6px 9px",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
