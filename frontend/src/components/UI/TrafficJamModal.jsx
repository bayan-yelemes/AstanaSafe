import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, MapPin, Info } from "./icons";
import { useAppStore } from "../../store/useAppStore";
import useDistrictsGeojson from "../../hooks/useDistrictsGeojson";
import { getNearestLocation } from "../../services/roadsService";
import { getDistrictForPoint } from "../../utils/districtUtils";
import { useI18n } from "../../i18n";
import styles from "./TrafficJamModal.module.css";

const categories = [
  "Active Traffic Jam",
  "Low Severity",
  "Medium Severity",
  "High Severity Accident",
];

const types = [
  "traffic_jam",
  "collision",
  "pedestrian",
  "rollover",
  "roadwork",
  "public_event",
  "road_closure",
  "stalled_vehicle",
  "police_checkpoint",
  "debris",
  "flooding",
  "other",
];
const weatherOptions = [
  "clear",
  "cloudy",
  "rain",
  "heavy_rain",
  "snow",
  "ice",
  "fog",
  "storm",
  "hail",
  "strong_wind",
  "poor_visibility",
];
const durationOptions = [
  { value: 15, labelKey: "trafficModal.durationShort" },
  { value: 30, labelKey: "trafficModal.durationMedium" },
  { value: 60, labelKey: "trafficModal.durationLong" },
];
const movementOptions = [
  { value: "slow", labelKey: "trafficModal.movementSlow" },
  { value: "stopped", labelKey: "trafficModal.movementStopped" },
  { value: "blocked", labelKey: "trafficModal.movementBlocked" },
];
const laneOptions = [
  { value: "one", labelKey: "trafficModal.lanesOne" },
  { value: "two", labelKey: "trafficModal.lanesTwo" },
  { value: "unknown", labelKey: "trafficModal.lanesUnknown" },
];

function normalizeLocationDisplay(location) {
  const rawRoad = String(location?.road || "").trim();
  const rawCrossroad = String(location?.crossroad || "").trim();

  if (rawRoad && rawCrossroad) {
    if (rawRoad.toLowerCase() === rawCrossroad.toLowerCase()) {
      return { road: rawRoad, crossroad: "" };
    }
    return { road: rawRoad, crossroad: rawCrossroad };
  }

  if (rawRoad) return { road: rawRoad, crossroad: "" };
  if (rawCrossroad) return { road: rawCrossroad, crossroad: "" };

  return { road: "", crossroad: "" };
}

export default function TrafficJamModal({
  open,
  onClose,
  selectedPoint = null,
}) {
  const { t, tc, tt, tw } = useI18n();
  const navigate = useNavigate();

  const streets = useAppStore((state) => state.streets);
  const intersections = useAppStore((state) => state.intersections);
  const roadsLoading = useAppStore((state) => state.roadsLoading);
  const fetchStreets = useAppStore((state) => state.fetchStreets);
  const fetchIntersections = useAppStore((state) => state.fetchIntersections);
  const addTrafficReport = useAppStore((state) => state.addTrafficReport);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const setFocusedReportPoint = useAppStore(
    (state) => state.setFocusedReportPoint,
  );

  const [road, setRoad] = useState("");
  const [crossroad, setCrossroad] = useState("");
  const [category, setCategory] = useState("Active Traffic Jam");
  const [type, setType] = useState("traffic_jam");
  const [weather, setWeather] = useState("clear");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [trafficFlow, setTrafficFlow] = useState("slow");
  const [lanesBlocked, setLanesBlocked] = useState("one");
  const [notes, setNotes] = useState("");
  const [nearestLocation, setNearestLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const districtsGeojson = useDistrictsGeojson();

  const [roadQuery, setRoadQuery] = useState("");
  const [crossroadQuery, setCrossroadQuery] = useState("");
  const [showRoadDropdown, setShowRoadDropdown] = useState(false);
  const [showCrossroadDropdown, setShowCrossroadDropdown] = useState(false);

  const isMapMode = !!selectedPoint;

  useEffect(() => {
    if (open) {
      fetchStreets();
      const timer = window.setTimeout(() => {
        setRoad("");
        setCrossroad("");
        setRoadQuery("");
        setCrossroadQuery("");
        setCategory("Active Traffic Jam");
        setType("traffic_jam");
        setWeather("clear");
        setDurationMinutes(30);
        setTrafficFlow("slow");
        setLanesBlocked("one");
        setNotes("");
        setNearestLocation(null);
        setSubmitError("");
        setShowRoadDropdown(false);
        setShowCrossroadDropdown(false);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [open, fetchStreets]);

  useEffect(() => {
    if (road && !isMapMode) {
      fetchIntersections(road);
      const timer = window.setTimeout(() => {
        setCrossroad("");
        setCrossroadQuery("");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [road, fetchIntersections, isMapMode]);

  useEffect(() => {
    if (open && isMapMode && selectedPoint) {
      let active = true;

      const timer = window.setTimeout(() => {
        if (!active) return;
        setLocationLoading(true);

        getNearestLocation(selectedPoint.lat, selectedPoint.lng)
          .then((location) => {
            if (active) setNearestLocation(location);
          })
          .catch(() => {
            if (active) setNearestLocation(null);
          })
          .finally(() => {
            if (active) setLocationLoading(false);
          });
      }, 0);

      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }
  }, [open, isMapMode, selectedPoint]);

  const resolvedNearestLocation = useMemo(() => {
    return normalizeLocationDisplay(nearestLocation);
  }, [nearestLocation]);

  const filteredStreets = useMemo(() => {
    const q = roadQuery.trim().toLowerCase();

    if (!q) return streets.slice(0, 30);

    return streets
      .filter((item) => String(item).toLowerCase().includes(q))
      .slice(0, 30);
  }, [streets, roadQuery]);

  const ensureStreetsLoaded = () => {
    if (!streets.length && !roadsLoading) {
      fetchStreets();
    }
  };

  const filteredIntersections = useMemo(() => {
    const q = crossroadQuery.trim().toLowerCase();

    if (!q) return intersections.slice(0, 30);

    return intersections
      .filter((item) =>
        String(item.crossroad || "")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 30);
  }, [intersections, crossroadQuery]);

  if (!open) return null;

  const detailPayload = {
    duration_minutes: durationMinutes,
    traffic_flow: trafficFlow,
    lanes_blocked: lanesBlocked,
    notes: notes.trim() || null,
  };

  const selectedDurationLabel =
    durationOptions.find((item) => item.value === durationMinutes)?.labelKey ||
    durationOptions[1].labelKey;
  const selectedMovementLabel =
    movementOptions.find((item) => item.value === trafficFlow)?.labelKey ||
    movementOptions[0].labelKey;
  const selectedLanesLabel =
    laneOptions.find((item) => item.value === lanesBlocked)?.labelKey ||
    laneOptions[0].labelKey;

  const focusNewReport = (lat, lng, districtValue) => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();

    setSelectedDate(baseDate);
    setFocusedReportPoint({
      id: `new-report-${Date.now()}`,
      source: "traffic",
      lat,
      lng,
      date: baseDate,
      district: districtValue || "Unknown",
      type: category,
      severity:
        category === "High Severity Accident"
          ? "High"
          : category === "Medium Severity"
            ? "Medium"
            : category === "Low Severity"
              ? "Low"
              : "Traffic",
      weather,
    });

    onClose();
    navigate("/");
  };

  const handleSubmit = async () => {
    setSubmitError("");

    if (isMapMode) {
      const detectedDistrict =
        getDistrictForPoint(
          selectedPoint.lat,
          selectedPoint.lng,
          districtsGeojson,
        ) || "Unknown";

      const result = await addTrafficReport({
        road: resolvedNearestLocation.road,
        crossroad: resolvedNearestLocation.crossroad,
        category,
        type,
        weather,
        lat: selectedPoint.lat,
        lng: selectedPoint.lng,
        district: detectedDistrict,
        ...detailPayload,
      });

      if (!result?.ok) return;

      focusNewReport(selectedPoint.lat, selectedPoint.lng, detectedDistrict);
      return;
    }

    if (!road) {
      setSubmitError(t("trafficModal.chooseRoadAlert"));
      return;
    }

    const selectedIntersection = intersections.find(
      (item) => item.crossroad === crossroad,
    );

    if (!crossroad || !selectedIntersection) {
      setSubmitError(t("trafficModal.chooseIntersectionAlert"));
      return;
    }

    const detectedDistrict =
      getDistrictForPoint(
        selectedIntersection.lat,
        selectedIntersection.lng,
        districtsGeojson,
      ) || "Unknown";

    const result = await addTrafficReport({
      road,
      crossroad,
      category,
      type,
      weather,
      lat: selectedIntersection.lat,
      lng: selectedIntersection.lng,
      district: detectedDistrict,
      ...detailPayload,
    });

    if (!result?.ok) return;

    focusNewReport(
      selectedIntersection.lat,
      selectedIntersection.lng,
      detectedDistrict,
    );
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
        <div className={styles.trafficJamModalStyle1}>
          <div className={styles.iconWrapStyle}>
            <MapPin size={26} color="var(--accent)" />
          </div>

          <div>
            <div className={styles.titleStyle}>{t("trafficModal.title")}</div>
            <div className={styles.subtitleStyle}>
              {isMapMode
                ? t("trafficModal.mapSubtitle")
                : t("trafficModal.defaultSubtitle")}
            </div>
          </div>
        </div>

        {isMapMode ? (
          <div className={styles.infoBox}>
            {locationLoading ? (
              <div>{t("trafficModal.loadingNearestRoad")}</div>
            ) : (
              <>
                <div>
                  <strong>{t("common.road")}:</strong>{" "}
                  {resolvedNearestLocation.road || t("common.unknownRoad")}
                </div>

                {resolvedNearestLocation.crossroad ? (
                  <div>
                    <strong>{t("common.crossroad")}:</strong>{" "}
                    {resolvedNearestLocation.crossroad}
                  </div>
                ) : null}

                {selectedPoint && districtsGeojson ? (
                  <div>
                    <strong>{t("common.district")}:</strong>{" "}
                    {getDistrictForPoint(
                      selectedPoint.lat,
                      selectedPoint.lng,
                      districtsGeojson,
                    ) || t("common.unknown")}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <>
            <div className={styles.trafficJamModalStyle2}>
              <div className={styles.labelStyle}>
                {t("trafficModal.selectRoad")}
              </div>

              <input
                value={roadQuery}
                onChange={(e) => {
                  setRoadQuery(e.target.value);
                  setShowRoadDropdown(true);
                  ensureStreetsLoaded();
                }}
                onFocus={() => {
                  setShowRoadDropdown(true);
                  ensureStreetsLoaded();
                }}
                placeholder={t("trafficModal.roadPlaceholder")}
                className={styles.inputStyle}
              />

              {showRoadDropdown && (
                <div
                  className={["motion-dropdown", styles.dropdownStyle]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {roadsLoading && !road ? (
                    <div className={styles.emptyOptionStyle}>
                      {t("trafficModal.loadingNearestRoad")}
                    </div>
                  ) : filteredStreets.length > 0 ? (
                    filteredStreets.map((street) => (
                      <div
                        key={street}
                        onClick={() => {
                          setRoad(street);
                          setRoadQuery(street);
                          setCrossroad("");
                          setCrossroadQuery("");
                          fetchIntersections(street);
                          setShowRoadDropdown(false);
                          setShowCrossroadDropdown(true);
                        }}
                        className={styles.optionStyle}
                      >
                        {street}
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyOptionStyle}>
                      {t("trafficModal.noRoadsFound")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.trafficJamModalStyle3}>
              <div className={styles.labelStyle}>
                {t("trafficModal.crossroad")}
              </div>

              <input
                value={crossroadQuery}
                onChange={(e) => {
                  setCrossroadQuery(e.target.value);
                  if (road) setShowCrossroadDropdown(true);
                }}
                onFocus={() => {
                  if (road) setShowCrossroadDropdown(true);
                }}
                placeholder={
                  !road
                    ? t("trafficModal.selectRoadFirst")
                    : t("trafficModal.intersectionPlaceholder")
                }
                disabled={!road}
                className={[
                  styles.inputStyle,
                  road ? styles.inputEnabled : styles.inputDisabled,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />

              {road && showCrossroadDropdown && (
                <div
                  className={["motion-dropdown", styles.dropdownStyle]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {roadsLoading ? (
                    <div className={styles.emptyOptionStyle}>
                      {t("trafficModal.loadingIntersections")}
                    </div>
                  ) : filteredIntersections.length > 0 ? (
                    filteredIntersections.map((item) => (
                      <div
                        key={`${item.crossroad}-${item.lat}-${item.lng}`}
                        onClick={() => {
                          setCrossroad(item.crossroad);
                          setCrossroadQuery(item.crossroad);
                          setShowCrossroadDropdown(false);
                        }}
                        className={styles.optionStyle}
                      >
                        {item.crossroad}
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyOptionStyle}>
                      {t("trafficModal.noIntersections")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className={styles.trafficJamModalStyle4}>
          <div className={styles.labelStyle}>
            {t("trafficModal.incidentCategory")}
          </div>

          <div className={styles.gridStyle}>
            {categories.map((item) => {
              const active = category === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  style={{
                    ...categoryButton,
                    background: active
                      ? "linear-gradient(135deg, var(--primary), var(--accent))"
                      : "var(--surface)",
                    color: active ? "#fff" : "var(--text-muted)",
                    border: active ? "none" : "1px solid var(--border)",
                    boxShadow: active
                      ? "0 12px 24px rgba(37,99,235,0.18)"
                      : "none",
                  }}
                >
                  {tc(item)}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.trafficJamModalStyle5}>
          <div className={styles.labelStyle}>{t("common.type")}</div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={styles.inputStyle}
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {tt(item)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.trafficJamModalStyle6}>
          <div className={styles.labelStyle}>{t("common.weather")}</div>
          <select
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            className={styles.inputStyle}
          >
            {weatherOptions.map((item) => (
              <option key={item} value={item}>
                {tw(item)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.detailsPanel}>
          <div className={styles.detailsHeader}>
            <div className={styles.detailsIcon}>
              <Clock3 size={18} color="var(--primary)" />
            </div>
            <div>
              <div className={styles.detailsTitle}>
                {t("trafficModal.detailsTitle")}
              </div>
              <div className={styles.detailsSubtitle}>
                {t("trafficModal.detailsSubtitle")}
              </div>
            </div>
          </div>

          <div className={styles.detailGroup}>
            <div className={styles.labelStyle}>
              {t("trafficModal.durationLabel")}
            </div>
            <div className={styles.segmentedGrid}>
              {durationOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDurationMinutes(item.value)}
                  className={[
                    styles.detailOption,
                    durationMinutes === item.value
                      ? styles.detailOptionActive
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.detailGroup}>
            <div className={styles.labelStyle}>
              {t("trafficModal.movementLabel")}
            </div>
            <div className={styles.segmentedGrid}>
              {movementOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTrafficFlow(item.value)}
                  className={[
                    styles.detailOption,
                    trafficFlow === item.value ? styles.detailOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.detailGroup}>
            <div className={styles.labelStyle}>
              {t("trafficModal.lanesLabel")}
            </div>
            <div className={styles.segmentedGrid}>
              {laneOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLanesBlocked(item.value)}
                  className={[
                    styles.detailOption,
                    lanesBlocked === item.value
                      ? styles.detailOptionActive
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.detailGroup}>
            <div className={styles.labelStyle}>
              {t("trafficModal.noteLabel")}
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={180}
              placeholder={t("trafficModal.notePlaceholder")}
              className={styles.textareaStyle}
            />
          </div>

          <div className={styles.detailSummary}>
            <span>{t("trafficModal.summaryLabel")}</span>
            <strong>
              {t(selectedDurationLabel)} · {t(selectedMovementLabel)} ·{" "}
              {t(selectedLanesLabel)}
            </strong>
          </div>
        </div>

        <div className={styles.blueBox}>
          <Info
            size={18}
            color="#2563eb"
            className={styles.trafficJamModalStyle7}
          />
          <div>{t("trafficModal.visibleRealtime")}</div>
        </div>

        {submitError ? (
          <div className={styles.errorBox} role="alert">
            {submitError}
          </div>
        ) : null}

        <div className={styles.trafficJamModalStyle8}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            {t("common.cancel")}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className={styles.submitBtn}
          >
            {t("trafficModal.submitReport")}
          </button>
        </div>
      </div>
    </div>
  );
}

const categoryButton = {
  height: 40,
  borderRadius: 14,
  fontWeight: 700,
  cursor: "pointer",
};
