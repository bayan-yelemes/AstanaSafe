import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock3, MapPin, ShieldAlert, X } from "./icons";
import { useAppStore } from "../../store/useAppStore";
import {
  getDistrictsGeojson,
  getNearestLocation,
} from "../../services/roadsService";
import { getDistrictForPoint } from "../../utils/districtUtils";
import { reportError } from "../../utils/logger";
import { useI18n } from "../../i18n";
import styles from "./SosEmergencyModal.module.css";

const DEMO_LOCATION = {
  lat: 51.1283,
  lng: 71.4306,
  accuracyM: 35,
};

const dateLocales = {
  en: "en-GB",
  ru: "ru-RU",
  kz: "kk-KZ",
};

const serviceLabels = {
  police: "sosEmergency.police",
  ambulance: "sosEmergency.ambulance",
  road_service: "sosEmergency.roadService",
  city_dispatch: "sosEmergency.cityDispatch",
};

function formatCoords(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return "--";
  }

  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

function buildTimeLabel(language, date = new Date()) {
  return date.toLocaleString(dateLocales[language] || dateLocales.ru, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatusRow({ done, label, detail }) {
  return (
    <div className={styles.statusRowStyle}>
      <div
        style={{
          ...statusDotStyle,
          background: done ? "#dcfce7" : "#fee2e2",
          color: done ? "#16a34a" : "#ef4444",
        }}
      >
        {done ? <Check size={15} /> : <Clock3 size={15} />}
      </div>
      <div className={styles.sosEmergencyModalStyle1}>
        <div className={styles.statusLabelStyle}>{label}</div>
        {detail ? (
          <div className={styles.statusDetailStyle}>{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

function InfoCell({ label, value, danger = false }) {
  return (
    <div className={styles.infoCellStyle}>
      <div className={styles.infoLabelStyle}>{label}</div>
      <div
        style={{
          ...infoValueStyle,
          color: danger ? "#dc2626" : "var(--text-heading)",
        }}
      >
        {value || "--"}
      </div>
    </div>
  );
}

export default function SosEmergencyModal({ open, onClose }) {
  const { language, t } = useI18n();
  const currentUser = useAppStore((state) => state.currentUser);
  const createSosIncident = useAppStore((state) => state.createSosIncident);
  const fetchSosIncidents = useAppStore((state) => state.fetchSosIncidents);

  const [phase, setPhase] = useState("idle");
  const [draft, setDraft] = useState(null);
  const [sentIncident, setSentIncident] = useState(null);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [createdTime, setCreatedTime] = useState("");

  const reporterName =
    currentUser?.full_name || currentUser?.name || t("sosEmergency.reporterName");

  const buildDraftFromPoint = useCallback(
    async ({ lat, lng, accuracyM, demo = false }) => {
      setPhase("locating");
      setError("");

      let nearestLocation = null;
      let districtsGeojson = null;

      try {
        [nearestLocation, districtsGeojson] = await Promise.all([
          getNearestLocation(lat, lng),
          getDistrictsGeojson(),
        ]);
      } catch (requestError) {
        reportError("Failed to enrich SOS location:", requestError);
      }

      const district =
        getDistrictForPoint(lat, lng, districtsGeojson) ||
        nearestLocation?.district ||
        "Unknown";

      setCreatedTime(buildTimeLabel(language));
      setDraft({
        lat,
        lng,
        accuracyM,
        road: nearestLocation?.road || "",
        crossroad: nearestLocation?.crossroad || "",
        district,
        incidentType: "Road accident",
        urgency: "critical",
        reporterName,
        reporterPhone: currentUser?.phone || "",
        reporterEmail: currentUser?.email || "",
        demo,
      });
      setPhase("ready");
    },
    [currentUser?.email, currentUser?.phone, language, reporterName],
  );

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setPhase("locating");
      setDraft(null);
      setSentIncident(null);
      setError("");
      setDescription("");
      setCreatedTime("");

      if (!navigator.geolocation) {
        setError(t("sosEmergency.geolocationUnsupported"));
        setPhase("location-error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          buildDraftFromPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyM: Math.round(position.coords.accuracy || 0),
            demo: false,
          });
        },
        () => {
          setError(t("sosEmergency.geolocationUnavailable"));
          setPhase("location-error");
        },
        {
          enableHighAccuracy: true,
          timeout: 9000,
          maximumAge: 15000,
        },
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [buildDraftFromPoint, open, t]);

  const services = useMemo(() => {
    const log = sentIncident?.notificationLog || [];

    return ["police", "ambulance", "road_service", "city_dispatch"].map(
      (service) => ({
        service,
        label: t(serviceLabels[service]),
        done: log.some((item) => item.service === service),
      }),
    );
  }, [sentIncident, t]);

  if (!open) return null;

  const submitSos = async () => {
    if (!draft) return;

    setPhase("submitting");
    setError("");

    const result = await createSosIncident({
      ...draft,
      description:
        description.trim() ||
        t("sosEmergency.defaultDescription"),
    });

    if (!result.ok) {
      setError(t("sosEmergency.createError"));
      setPhase("ready");
      return;
    }

    setSentIncident(result.incident);
    fetchSosIncidents({ activeOnly: false });
    setPhase("sent");
  };

  const useDemoLocation = () => {
    buildDraftFromPoint({
      ...DEMO_LOCATION,
      demo: true,
    });
  };

  return (
    <div
      className={["modal-backdrop", styles.overlayStyle]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={["motion-modal", styles.modalStyle]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButtonStyle}
        >
          <X size={18} />
        </button>

        <div className={styles.headerStyle}>
          <div className={styles.sosIconStyle}>
            <ShieldAlert size={30} color="#fff" />
          </div>
          <div className={styles.sosEmergencyModalStyle2}>
            <div className={styles.eyebrowStyle}>{t("sosEmergency.modeKicker")}</div>
            <div className={styles.titleStyle}>{t("sosEmergency.title")}</div>
            <div className={styles.subtitleStyle}>
              {t("sosEmergency.subtitle")}
            </div>
          </div>
        </div>

        {phase === "locating" ? (
          <div aria-busy="true" className={styles.loadingBoxStyle}>
            <MapPin size={24} color="#dc2626" />
            <div>
              <div className={styles.loadingTitleStyle}>
                {t("sosEmergency.locatingTitle")}
              </div>
              <div className={styles.subtitleStyle}>
                {t("sosEmergency.locatingSubtitle")}
              </div>
            </div>
          </div>
        ) : null}

        {phase === "location-error" ? (
          <div className={styles.errorBoxStyle}>
            <AlertTriangle size={22} color="#dc2626" />
            <div className={styles.sosEmergencyModalStyle3}>
              <div className={styles.errorTitleStyle}>{error}</div>
              <button
                type="button"
                onClick={useDemoLocation}
                className={styles.demoButtonStyle}
              >
                {t("sosEmergency.useDemoLocation")}
              </button>
            </div>
          </div>
        ) : null}

        {draft && phase !== "sent" ? (
          <>
            <div className={styles.cardTitleRowStyle}>
              <div>
                <div className={styles.sectionKickerStyle}>
                  {t("sosEmergency.incidentCard")}
                </div>
                <div className={styles.sectionTitleStyle}>
                  {t("sosEmergency.emergencyAccident")}
                </div>
              </div>
              <div className={styles.urgencyBadgeStyle}>
                {t("sosEmergency.highUrgency")}
              </div>
            </div>

            <div className={styles.infoGridStyle}>
              <InfoCell
                label={t("sosEmergency.coordinates")}
                value={formatCoords(draft.lat, draft.lng)}
              />
              <InfoCell label={t("sosEmergency.time")} value={createdTime} />
              <InfoCell label={t("sosEmergency.type")} value={t("sosEmergency.accidentType")} />
              <InfoCell label={t("sosEmergency.level")} value={t("sosEmergency.critical")} danger />
              <InfoCell
                label={t("sosEmergency.district")}
                value={
                  draft.district === "Unknown"
                    ? t("sosEmergency.notDetected")
                    : draft.district
                }
              />
              <InfoCell
                label={t("sosEmergency.accuracy")}
                value={
                  draft.accuracyM
                    ? t("sosEmergency.accuracyMeters", { value: draft.accuracyM })
                    : "--"
                }
              />

              <InfoCell
                label={t("sosEmergency.road")}
                value={draft.road || t("sosEmergency.notDetected")}
              />
              <InfoCell
                label={t("sosEmergency.crossroad")}
                value={draft.crossroad || t("sosEmergency.notDetected")}
              />
            </div>

            <label className={styles.textareaLabelStyle}>
              {t("sosEmergency.comment")}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("sosEmergency.commentPlaceholder")}
                className={styles.textareaStyle}
              />
            </label>

            {error ? (
              <div className={styles.errorMessageStyle}>
                <AlertTriangle size={18} color="#dc2626" />
                {error}
              </div>
            ) : null}

            <div className={styles.actionRowStyle}>
              <button
                type="button"
                onClick={onClose}
                className={styles.secondaryButtonStyle}
              >
                {t("sosEmergency.cancel")}
              </button>
              <button
                type="button"
                onClick={submitSos}
                disabled={phase === "submitting"}
                className={[
                  styles.primaryButtonStyle,
                  phase === "submitting" ? styles.primaryButtonPending : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {phase === "submitting"
                  ? t("sosEmergency.sending")
                  : t("sosEmergency.submit")}
              </button>
            </div>
          </>
        ) : null}

        {sentIncident ? (
          <>
            <div className={styles.successBoxStyle}>
              <Check size={24} color="#16a34a" />
              <div>
                <div className={styles.successTitleStyle}>
                  {t("sosEmergency.created")}
                </div>
                <div className={styles.successTextStyle}>
                  {t("sosEmergency.ticket", { ticket: sentIncident.ticket })}
                </div>
              </div>
            </div>

            <div className={styles.sosEmergencyModalStyle4}>
              <StatusRow
                done
                label={t("sosEmergency.cardCreated")}
                detail={`${sentIncident.road || t("sosEmergency.unknownRoad")} · ${formatCoords(
                  sentIncident.lat,
                  sentIncident.lng,
                )}`}
              />

              {services.map((service) => (
                <StatusRow
                  key={service.service}
                  done={service.done}
                  label={service.label}
                  detail={t("sosEmergency.notificationSent")}
                />
              ))}
            </div>

            <div className={styles.actionRowStyle}>
              <button
                type="button"
                onClick={onClose}
                className={styles.primaryButtonStyle}
              >
                {t("sosEmergency.close")}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const infoValueStyle = {
  fontSize: 14,
  fontWeight: 850,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statusDotStyle = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
