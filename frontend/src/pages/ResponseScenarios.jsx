import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "../components/UI/icons";
import SectionCard from "../components/UI/SectionCard";
import Topbar from "../components/UI/Topbar";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import styles from "./ResponseScenarios.module.css";

const dateLocales = {
  en: "en-GB",
  ru: "ru-RU",
  kz: "kk-KZ",
};

const statusMeta = {
  new: {
    labelKey: "sosStatus.new",
    color: "#dc2626",
    stepIndex: 0,
  },
  accepted: {
    labelKey: "sosStatus.acceptedByDispatcher",
    color: "#f97316",
    stepIndex: 2,
  },
  dispatched: {
    labelKey: "sosStatus.dispatched",
    color: "#2563eb",
    stepIndex: 3,
  },
  resolved: {
    labelKey: "sosStatus.resolved",
    color: "#16a34a",
    stepIndex: 4,
  },
  cancelled: {
    labelKey: "sosStatus.cancelled",
    color: "#64748b",
    stepIndex: 0,
  },
};

const scenarioSteps = [
  {
    key: "new",
    titleKey: "responseScenarios.driverSentSignal",
    statusKey: "responseScenarios.created",
    actorKey: "responseScenarios.driver",
    icon: AlertTriangle,
    color: "#dc2626",
  },
  {
    key: "accepted",
    titleKey: "responseScenarios.dispatcherAccepted",
    statusKey: "responseScenarios.accepted",
    actorKey: "responseScenarios.dispatcher",
    icon: ShieldAlert,
    color: "#f97316",
  },
  {
    key: "police",
    titleKey: "responseScenarios.policeNotified",
    statusKey: "responseScenarios.notification",
    actorKey: "responseScenarios.police",
    icon: ShieldCheck,
    color: "#2563eb",
  },
  {
    key: "dispatched",
    titleKey: "responseScenarios.serviceOnWay",
    statusKey: "responseScenarios.onWay",
    actorKey: "responseScenarios.service",
    icon: MapPin,
    color: "#2563eb",
  },
  {
    key: "resolved",
    titleKey: "responseScenarios.incidentCompleted",
    statusKey: "sosStatus.resolved",
    actorKey: "responseScenarios.system",
    icon: Check,
    color: "#16a34a",
  },
];

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

function getIncidentPlace(incident, t) {
  if (!incident) return t("responseScenarios.noSosSelected");

  return (
    [incident.road, incident.crossroad].filter(Boolean).join(" · ") ||
    t("responseScenarios.unknownRoad")
  );
}

function getStepDetail(step, incident, t) {
  if (!incident) {
    return t("responseScenarios.noScenarioDetail");
  }

  const place = getIncidentPlace(incident, t);

  if (step.key === "new") {
    return t("responseScenarios.createdDetail", {
      ticket: incident.ticket,
      place,
      coords: formatCoords(incident.lat, incident.lng),
    });
  }

  if (step.key === "accepted") {
    return t("responseScenarios.acceptedDetail");
  }

  if (step.key === "police") {
    return t("responseScenarios.policeDetail");
  }

  if (step.key === "dispatched") {
    return t("responseScenarios.dispatchedDetail");
  }

  return t("responseScenarios.resolvedDetail");
}

function getEventTime(incident, stepKey, language) {
  if (!incident) return "--";

  if (stepKey === "new") return formatDateTime(incident.createdAt, language);

  const dispatcherLog = [...(incident.notificationLog || [])]
    .reverse()
    .find((item) => item.status === stepKey || item.service === "dispatcher");

  if (dispatcherLog?.sent_at) return formatDateTime(dispatcherLog.sent_at, language);

  if (["accepted", "police", "dispatched", "resolved"].includes(stepKey)) {
    return formatDateTime(incident.updatedAt, language);
  }

  return "--";
}

function StepCard({ step, index, active, completed, incident, t }) {
  const Icon = step.icon;

  return (
    <div
      className={[
        styles.stepCard,
        active ? styles.stepCardActive : "",
        completed ? styles.stepCardCompleted : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderColor: active || completed ? step.color : "var(--border)",
      }}
    >
      <div
        className={styles.stepIcon}
        style={{
          color: step.color,
          background: `${step.color}14`,
        }}
      >
        <Icon size={20} />
      </div>
      <div className={styles.stepBody}>
        <div className={styles.stepNumber}>
          {t("responseScenarios.step", { count: index + 1 })}
        </div>
        <strong>{t(step.titleKey)}</strong>
        <p>{getStepDetail(step, incident, t)}</p>
      </div>
      <span
        className={styles.stepStatus}
        style={{
          color: step.color,
          background: `${step.color}14`,
        }}
      >
        {t(step.statusKey)}
      </span>
    </div>
  );
}

function EventRow({ step, visible, incident, language, t }) {
  if (!visible) return null;

  return (
    <div className={styles.eventRow}>
      <div
        className={styles.eventDot}
        style={{
          background: step.color,
        }}
      />
      <div>
        <strong>{t(step.actorKey)}</strong>
        <span>{getStepDetail(step, incident, t)}</span>
      </div>
      <div className={styles.eventTime}>
        {getEventTime(incident, step.key, language)}
      </div>
    </div>
  );
}

function SignalStatus({ status, t }) {
  const meta = getStatusMeta(status);

  return (
    <span
      className={styles.signalStatus}
      style={{
        color: meta.color,
        background: `${meta.color}14`,
      }}
    >
      {t(meta.labelKey)}
    </span>
  );
}

export default function ResponseScenarios() {
  const { language, t } = useI18n();
  const sosIncidents = useAppStore((state) => state.sosIncidents);
  const fetchSosIncidents = useAppStore((state) => state.fetchSosIncidents);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadIncidents = useCallback(async () => {
    setRefreshing(true);
    await fetchSosIncidents({ activeOnly: false });
    setRefreshing(false);
  }, [fetchSosIncidents]);

  useEffect(() => {
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
  }, [fetchSosIncidents, loadIncidents]);

  const sortedIncidents = useMemo(() => {
    return [...sosIncidents].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [sosIncidents]);

  const activeIncidents = useMemo(() => {
    return sortedIncidents.filter((item) =>
      ["new", "accepted", "dispatched"].includes(item.status),
    );
  }, [sortedIncidents]);

  const visibleIncidents = activeIncidents.length
    ? activeIncidents
    : sortedIncidents.slice(0, 6);

  const selectedIncident =
    sortedIncidents.find((item) => item.id === selectedIncidentId) ||
    visibleIncidents[0] ||
    null;

  const currentMeta = getStatusMeta(selectedIncident?.status);
  const activeIndex = selectedIncident ? currentMeta.stepIndex : 0;
  const currentStep = scenarioSteps[activeIndex] || scenarioSteps[0];
  const progress = selectedIncident
    ? ((activeIndex + 1) / scenarioSteps.length) * 100
    : 0;

  const metrics = useMemo(
    () => ({
      active: activeIncidents.length,
      new: sortedIncidents.filter((item) => item.status === "new").length,
      accepted: sortedIncidents.filter((item) => item.status === "accepted")
        .length,
      dispatched: sortedIncidents.filter((item) => item.status === "dispatched")
        .length,
    }),
    [activeIncidents.length, sortedIncidents],
  );

  return (
    <div>
      <Topbar
        titleKey="nav.responseScenarios"
        showTrafficAction={false}
        showEmergencyAction={false}
      />

      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>LIVE SOS FLOW</div>
          <h1>{t("responseScenarios.title")}</h1>
          <p>{t("responseScenarios.description")}</p>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={loadIncidents} className={styles.primary}>
            <RefreshCw size={17} />
            {refreshing
              ? t("responseScenarios.updating")
              : t("responseScenarios.refreshSignals")}
          </button>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <div>
          <span>{t("responseScenarios.activeSos")}</span>
          <strong>{metrics.active}</strong>
        </div>
        <div>
          <span>{t("responseScenarios.created")}</span>
          <strong>{metrics.new}</strong>
        </div>
        <div>
          <span>{t("responseScenarios.accepted")}</span>
          <strong>{metrics.accepted}</strong>
        </div>
        <div>
          <span>{t("responseScenarios.serviceDispatched")}</span>
          <strong>{metrics.dispatched}</strong>
        </div>
      </div>

      <SectionCard className={styles.demoCard}>
        <div className={styles.demoHeader}>
          <div>
            <div className={styles.demoTicket}>
              {selectedIncident?.ticket || t("responseScenarios.noSosSelected")}
            </div>
            <h2>
              {selectedIncident
                ? t(currentStep.titleKey)
                : t("responseScenarios.noActiveSignals")}
            </h2>
            <p>
              {selectedIncident
                ? getStepDetail(currentStep, selectedIncident, t)
                : t("responseScenarios.sendSosHint")}
            </p>
          </div>
          <div
            className={styles.currentStatus}
            style={{
              color: currentMeta.color,
              background: `${currentMeta.color}14`,
            }}
          >
            {selectedIncident ? t(currentMeta.labelKey) : t("responseScenarios.waiting")}
          </div>
        </div>

        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{
              width: `${progress}%`,
              background: currentMeta.color,
            }}
          />
        </div>

        <div className={styles.flowGrid}>
          {scenarioSteps.map((step, index) => (
            <StepCard
              key={step.key}
              step={step}
              index={index}
              active={selectedIncident && index === activeIndex}
              completed={selectedIncident && index < activeIndex}
              incident={selectedIncident}
              t={t}
            />
          ))}
        </div>
      </SectionCard>

      <div className={styles.contentGrid}>
        <SectionCard>
          <div className={styles.sideHeader}>
            <ShieldAlert size={20} color="var(--primary)" />
            <h2>{t("responseScenarios.activeDispatcherSignals")}</h2>
          </div>

          <div className={styles.signalList}>
            {visibleIncidents.length === 0 ? (
              <div className={styles.emptyState}>
                <ShieldAlert size={28} color="#94a3b8" />
                <strong>{t("responseScenarios.noSignalsTitle")}</strong>
                <span>{t("responseScenarios.noSignalsText")}</span>
              </div>
            ) : (
              visibleIncidents.map((incident) => {
                const selected = incident.id === selectedIncident?.id;

                return (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className={[
                      styles.signalButton,
                      selected ? styles.signalButtonActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className={styles.signalMain}>
                      <strong>{incident.ticket}</strong>
                      <small>{getIncidentPlace(incident, t)}</small>
                    </span>
                    <SignalStatus status={incident.status} t={t} />
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className={styles.sideHeader}>
            <Clock3 size={20} color="var(--primary)" />
            <h2>{t("responseScenarios.responseLog")}</h2>
          </div>

          <div className={styles.eventList}>
            {scenarioSteps.map((step, index) => (
              <EventRow
                key={step.key}
                step={step}
                visible={!!selectedIncident && index <= activeIndex}
                incident={selectedIncident}
                language={language}
                t={t}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <div className={styles.sideHeader}>
            <MapPin size={20} color="#16a34a" />
            <h2>{t("responseScenarios.requestData")}</h2>
          </div>

          <div className={styles.payloadGrid}>
            <div>
              <span>{t("responseScenarios.coordinates")}</span>
              <strong>
                {selectedIncident
                  ? formatCoords(selectedIncident.lat, selectedIncident.lng)
                  : "--"}
              </strong>
            </div>
            <div>
              <span>{t("responseScenarios.district")}</span>
              <strong>{selectedIncident?.district || "--"}</strong>
            </div>
            <div>
              <span>{t("responseScenarios.location")}</span>
              <strong>
                {selectedIncident ? getIncidentPlace(selectedIncident, t) : "--"}
              </strong>
            </div>
            <div>
              <span>{t("responseScenarios.updated")}</span>
              <strong>{formatDateTime(selectedIncident?.updatedAt, language)}</strong>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
