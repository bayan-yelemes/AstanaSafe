import {
  AlertTriangle,
  MapPin,
  Plus,
  ShieldCheck,
  X,
} from "../../components/UI/icons";
import styles from "../../components/Map/AccidentMap.module.css";
import { getRiskColor, getRiskTint } from "./riskPanelHelpers";

function formatMetric(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function toCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getLocalizedRiskLevel(level, copy) {
  const key = String(level || "UNKNOWN").toUpperCase();
  return copy.riskLevels[key] || copy.riskLevels.UNKNOWN;
}

function getRiskPlace(location, copy) {
  const district = String(location?.district || "").trim();
  return district && district !== "Unknown" ? district : copy.thisPartOfAstana;
}

function getPeakName(stats, copy) {
  const peakName = String(stats?.peak_hour?.name || "").trim();
  if (!peakName || peakName === "--:--") return copy.noPeakData;
  return peakName;
}

function buildLocalizedRiskExplanation(analysis, copy) {
  const stats = analysis?.statistics || {};
  const level = getLocalizedRiskLevel(analysis?.risk?.level, copy);

  return copy.explanation({
    level,
    score: analysis?.risk?.score ?? "--",
    accidents: toCount(stats.historical_accidents),
    reports: toCount(stats.traffic_reports),
    place: getRiskPlace(analysis?.location, copy),
    peak: getPeakName(stats, copy),
  });
}

function buildLocalizedRiskReasons(analysis, copy, tw) {
  const stats = analysis?.statistics || {};
  const nearest = analysis?.location?.nearest_intersection;
  const score = toCount(analysis?.risk?.score);
  const accidentCount = toCount(stats.historical_accidents);
  const trafficReports = toCount(stats.traffic_reports);
  const activeJams = toCount(stats.active_jams);
  const peakHour = stats.peak_hour || {};
  const topWeather = String(stats.top_weather?.name || "").toLowerCase();

  const reasons = [
    accidentCount > 0
      ? copy.reasons.accidents(accidentCount)
      : copy.reasons.noAccidents,
  ];

  if (activeJams > 0) {
    reasons.push(copy.reasons.activeJams(activeJams));
  } else if (trafficReports > 0) {
    reasons.push(copy.reasons.userReports(trafficReports));
  }

  if (nearest && nearest.distance_m <= 180) {
    reasons.push(
      copy.reasons.nearIntersection(
        nearest.road,
        nearest.crossroad,
        nearest.distance_m,
      ),
    );
  }

  if (["rain", "snow", "ice", "storm"].includes(topWeather)) {
    reasons.push(copy.reasons.badWeather(tw(topWeather)));
  }

  if (toCount(peakHour.count) >= 2) {
    reasons.push(copy.reasons.peakHour(peakHour.name));
  }

  if (score >= 70) {
    reasons.push(copy.reasons.aboveBaseline);
  } else if (score >= 40) {
    reasons.push(copy.reasons.moderate);
  } else {
    reasons.push(copy.reasons.low);
  }

  return reasons.slice(0, 5);
}

function getInterventionCopyKey(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("speed")) return "speedCalming";
  if (text.includes("signal")) return "signalTiming";
  if (text.includes("lighting") || text.includes("visibility"))
    return "lighting";
  if (text.includes("congestion") || text.includes("traffic"))
    return "congestion";
  return "default";
}

function localizeIntervention(item, copy) {
  const localized =
    copy.interventions[getInterventionCopyKey(item?.name)] ||
    copy.interventions.default;

  return {
    ...item,
    name: localized.name,
    detail: localized.detail,
  };
}

function RiskMetric({ label, value }) {
  return (
    <div className={styles.accidentMapStyle1}>
      <div className={styles.accidentMapStyle2}>{label}</div>
      <div className={styles.accidentMapStyle3}>{value}</div>
    </div>
  );
}

export default function RiskAnalysisPanel({
  point,
  analysis,
  loading,
  error,
  onClose,
  onReport,
  copy,
  tw,
}) {
  if (!point && !analysis && !loading && !error) {
    return (
      <div className={styles.accidentMapStyle4}>
        <ShieldCheck size={16} />
        {copy.mlZoneScan}
      </div>
    );
  }

  const level = analysis?.risk?.level || "LOW";
  const score = analysis?.risk?.score ?? "--";
  const riskColor = getRiskColor(level);
  const riskTint = getRiskTint(level);
  const stats = analysis?.statistics || {};
  const location = analysis?.location || {};
  const nearest = location.nearest_intersection;
  const localizedLevel = getLocalizedRiskLevel(level, copy);
  const localizedReasons = analysis
    ? buildLocalizedRiskReasons(analysis, copy, tw)
    : [];
  const localizedInterventions = (analysis?.interventions || [])
    .slice(0, 3)
    .map((item) => localizeIntervention(item, copy));

  return (
    <div className={styles.accidentMapStyle5}>
      <div className={styles.accidentMapStyle6}>
        <div className={styles.accidentMapStyle7}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "14px",
              background: riskTint,
              color: riskColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} />
          </div>

          <div className={styles.accidentMapStyle8}>
            <div className={styles.accidentMapStyle9}>{copy.mlSafetyZone}</div>
            <div className={styles.accidentMapStyle10}>
              {analysis?.zone?.id || copy.analyzingArea}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={styles.accidentMapStyle11}
        >
          <X size={17} />
        </button>
      </div>

      {loading ? (
        <div className={styles.accidentMapStyle12}>{copy.calculatingRisk}</div>
      ) : error ? (
        <div className={styles.accidentMapStyle13}>
          <AlertTriangle size={18} />
          <span>
            {error === "riskUnavailable" ? copy.riskUnavailable : error}
          </span>
        </div>
      ) : analysis ? (
        <div className={styles.accidentMapStyle14}>
          <div className={styles.accidentMapStyle15}>
            <div
              style={{
                borderRadius: "18px",
                background: riskTint,
                border: `1px solid ${riskColor}22`,
                padding: "14px",
                color: riskColor,
              }}
            >
              <div className={styles.accidentMapStyle16}>{score}</div>
              <div className={styles.accidentMapStyle17}>
                {copy.riskBadge(localizedLevel)}
              </div>
            </div>

            <div className={styles.accidentMapStyle18}>
              <div className={styles.accidentMapStyle19}>
                <MapPin size={15} color="var(--primary)" />
                <span className={styles.accidentMapStyle20}>
                  {location.district || copy.unknownDistrict}
                </span>
              </div>
              <div className={styles.accidentMapStyle21}>
                {nearest
                  ? `${nearest.road}${nearest.crossroad ? ` / ${nearest.crossroad}` : ""} (${nearest.distance_m} m)`
                  : copy.noCloseIntersection}
              </div>
            </div>
          </div>

          <div className={styles.accidentMapStyle22}>
            <RiskMetric
              label={copy.accidents}
              value={formatMetric(stats.historical_accidents)}
            />

            <RiskMetric
              label={copy.reports}
              value={formatMetric(stats.traffic_reports)}
            />

            <RiskMetric
              label={copy.peak}
              value={formatMetric(stats.peak_hour?.name, "--")}
            />
          </div>

          <div className={styles.accidentMapStyle23}>
            {buildLocalizedRiskExplanation(analysis, copy)}
          </div>

          <div className={styles.accidentMapStyle24}>
            <div className={styles.accidentMapStyle25}>{copy.mainFactors}</div>
            <div className={styles.accidentMapStyle26}>
              {localizedReasons.map((reason) => (
                <div key={reason} className={styles.accidentMapStyle27}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "999px",
                      background: riskColor,
                      marginTop: "5px",
                    }}
                  />

                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.accidentMapStyle28}>
            <div className={styles.accidentMapStyle29}>{copy.lowerRisk}</div>
            <div className={styles.accidentMapStyle30}>
              {localizedInterventions.map((item) => (
                <div key={item.name} className={styles.accidentMapStyle31}>
                  <div className={styles.accidentMapStyle32}>
                    <div className={styles.accidentMapStyle33}>{item.name}</div>
                    <div className={styles.accidentMapStyle34}>
                      {item.detail}
                    </div>
                  </div>
                  <div className={styles.accidentMapStyle35}>
                    {item.projected_score}/100
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onReport}
            className={styles.accidentMapStyle36}
          >
            <Plus size={17} />
            {copy.markAtPoint}
          </button>
        </div>
      ) : null}
    </div>
  );
}
