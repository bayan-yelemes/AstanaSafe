import {
  MapContainer,
  TileLayer,
  CircleMarker,
  GeoJSON,
  Polygon,
  useMap,
  useMapEvents,
  Popup,
} from "react-leaflet";
import { useAppStore } from "../../store/useAppStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, MapPin } from "../UI/icons";
import useDistrictsGeojson from "../../hooks/useDistrictsGeojson";
import { analyzeRiskZone } from "../../services/riskService";
import {
  getDistrictForPoint,
  resolveDisplayDistrict,
} from "../../utils/districtUtils";
import { reportError } from "../../utils/logger";
import RiskAnalysisPanel from "../../features/risk/RiskAnalysisPanel";
import {
  getRiskColor,
  getRiskPanelCopy,
} from "../../features/risk/riskPanelHelpers";

import { useI18n } from "../../i18n";
import styles from "./AccidentMap.module.css";

function getColor(category) {
  if (category === "High Severity Accident") return "#ef4444";
  if (category === "Medium Severity") return "#f59e0b";
  if (category === "Low Severity") return "#3b82f6";
  if (category === "Active Traffic Jam") return "#8b5cf6";
  return "#64748b";
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function formatDateForApi(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function MapClickHandler({ onMapClick, markerClickedRef }) {
  useMapEvents({
    click(e) {
      setTimeout(() => {
        if (markerClickedRef.current) {
          markerClickedRef.current = false;
          return;
        }
        onMapClick(e.latlng);
      }, 0);
    },
  });

  return null;
}

function FocusOnReportPoint({ point, onDone }) {
  const map = useMap();

  useEffect(() => {
    if (!point) return;
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

    map.flyTo([point.lat, point.lng], 16, {
      duration: 1.2,
    });

    const timer = setTimeout(() => {
      if (onDone) onDone();
    }, 1600);

    return () => clearTimeout(timer);
  }, [point, map, onDone]);

  return null;
}

export default function AccidentMap({
  height = "520px",
  focusedReportPoint = null,
  externalReports = null,
}) {
  const { language, t, tc, tt, tw } = useI18n();
  const riskCopy = getRiskPanelCopy(language);
  const accidents = useAppStore((state) => state.accidents);
  const trafficReports = useAppStore((state) => state.trafficReports);
  const filters = useAppStore((state) => state.filters);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const clearFocusedReportPoint = useAppStore(
    (state) => state.clearFocusedReportPoint,
  );
  const openTrafficJamModal = useAppStore((state) => state.openTrafficJamModal);

  const districtsGeojson = useDistrictsGeojson();
  const [riskPoint, setRiskPoint] = useState(null);
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");

  const markerClickedRef = useRef(false);

  useEffect(() => {
    if (!riskPoint) return;

    const controller = new AbortController();

    const loadRiskAnalysis = async () => {
      try {
        setRiskLoading(true);
        setRiskError("");
        setRiskAnalysis(null);

        const params = {
          lat: riskPoint.lat,
          lng: riskPoint.lng,
          radius_m: 450,
        };

        const date = formatDateForApi(selectedDate);
        if (date) {
          params.date = date;
        }

        setRiskAnalysis(await analyzeRiskZone(params, controller.signal));
      } catch (error) {
        if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
          return;
        }
        reportError("Failed to analyze risk zone:", error);
        setRiskError("riskUnavailable");
      } finally {
        if (!controller.signal.aborted) {
          setRiskLoading(false);
        }
      }
    };

    loadRiskAnalysis();

    return () => controller.abort();
  }, [riskPoint, selectedDate]);

  const accidentsWithDistrict = useMemo(() => {
    return (accidents || [])
      .filter(
        (item) =>
          Number.isFinite(Number(item.latitude)) &&
          Number.isFinite(Number(item.longitude)),
      )
      .map((item) => ({
        ...item,
        source: "accident",
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        lat: Number(item.latitude),
        lng: Number(item.longitude),
        district: resolveDisplayDistrict(
          {
            ...item,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
          },
          districtsGeojson,
        ),
        createdAt: item.date,
        road: item.road || item.description || t("dashboard.historicalRecord"),
        crossroad: item.crossroad || "",
        weather: item.weather || "unknown",
        type: item.type || item.accident_type || "incident",
        category:
          item.severity === "high"
            ? "High Severity Accident"
            : item.severity === "medium"
              ? "Medium Severity"
              : "Low Severity",
      }));
  }, [accidents, districtsGeojson, t]);

  const trafficWithDistrict = useMemo(() => {
    return (trafficReports || [])
      .filter(
        (item) =>
          Number.isFinite(Number(item.lat)) &&
          Number.isFinite(Number(item.lng)),
      )
      .map((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);

        return {
          ...item,
          source: "traffic",
          lat,
          lng,
          district: resolveDisplayDistrict(
            {
              ...item,
              lat,
              lng,
            },
            districtsGeojson,
          ),
          type: item.type || "",
          weather: item.weather || "",
          createdAt: item.createdAt || item.created_at,
          road: item.road || t("common.unknownRoad"),
          crossroad: item.crossroad || "",
          category: item.category || "Active Traffic Jam",
        };
      });
  }, [trafficReports, districtsGeojson, t]);

  const fallbackCombinedItems = useMemo(() => {
    return [...accidentsWithDistrict, ...trafficWithDistrict];
  }, [accidentsWithDistrict, trafficWithDistrict]);

  const mapItems = useMemo(() => {
    if (Array.isArray(externalReports)) {
      return externalReports
        .filter(
          (item) =>
            Number.isFinite(Number(item.lat)) &&
            Number.isFinite(Number(item.lng)),
        )
        .map((item) => ({
          ...item,
          lat: Number(item.lat),
          lng: Number(item.lng),
          district:
            item.district ||
            getDistrictForPoint(
              Number(item.lat),
              Number(item.lng),
              districtsGeojson,
            ) ||
            "Unknown",
          road: item.road || item.description || t("common.unknownRoad"),
          crossroad: item.crossroad || "",
          weather: item.weather || "unknown",
          type: item.type || "incident",
          category: item.category || "Incident",
          createdAt: item.createdAt || item.created_at || item.date,
        }));
    }

    return fallbackCombinedItems.filter((item) => {
      const itemDistrict = normalizeText(item.district);
      const selectedDistrict = normalizeText(filters.district);

      const itemType = normalizeText(item.type);
      const selectedType = normalizeText(filters.type);

      const itemWeather = normalizeText(item.weather);
      const selectedWeather = normalizeText(filters.weather);

      const districtMatch =
        selectedDistrict === "all" || itemDistrict === selectedDistrict;

      const typeMatch = selectedType === "all" || itemType === selectedType;

      const weatherMatch =
        selectedWeather === "all" || itemWeather === selectedWeather;

      return districtMatch && typeMatch && weatherMatch;
    });
  }, [externalReports, fallbackCombinedItems, filters, districtsGeojson, t]);

  const handleMarkerInteraction = () => {
    markerClickedRef.current = true;
  };

  const closeRiskPanel = () => {
    setRiskPoint(null);
    setRiskAnalysis(null);
    setRiskError("");
    setRiskLoading(false);
  };

  const openReportAtRiskPoint = () => {
    if (!riskPoint) return;
    openTrafficJamModal(riskPoint);
  };

  return (
    <>
      <MapContainer
        center={[51.1694, 71.4491]}
        zoom={11}
        style={{ height, width: "100%", borderRadius: "18px" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FocusOnReportPoint
          point={focusedReportPoint}
          onDone={clearFocusedReportPoint}
        />

        <MapClickHandler
          onMapClick={(latlng) => {
            setRiskPoint({
              lat: latlng.lat,
              lng: latlng.lng,
            });
          }}
          markerClickedRef={markerClickedRef}
        />

        {districtsGeojson && (
          <GeoJSON
            data={districtsGeojson}
            style={() => ({
              color: "#6b7280",
              weight: 2,
              fillColor: "#6b7280",
              fillOpacity: 0.03,
            })}
          />
        )}

        {riskAnalysis?.zone?.polygon?.length > 0 && (
          <Polygon
            positions={riskAnalysis.zone.polygon.map((point) => [
              point.lat,
              point.lng,
            ])}
            pathOptions={{
              color: getRiskColor(riskAnalysis.risk?.level),
              fillColor: getRiskColor(riskAnalysis.risk?.level),
              fillOpacity: 0.12,
              weight: 2,
              dashArray: "8 8",
            }}
          />
        )}

        {mapItems.map((item) => (
          <CircleMarker
            key={`${item.source || "item"}-${item.id}`}
            center={[Number(item.lat), Number(item.lng)]}
            radius={item.category === "Active Traffic Jam" ? 10 : 8}
            pathOptions={{
              color: getColor(item.category),
              fillColor: getColor(item.category),
              fillOpacity: item.category === "Active Traffic Jam" ? 0.95 : 0.9,
              weight: 2,
            }}
            eventHandlers={{
              click: handleMarkerInteraction,
              mousedown: handleMarkerInteraction,
            }}
          >
            <Popup>
              <div className={styles.accidentMapStyle37}>
                <div className={styles.accidentMapStyle38}>
                  {tc(item.category)}
                </div>
                <div className={styles.accidentMapStyle39}>
                  {item.road || t("common.unknownRoad")}
                  {item.crossroad ? ` · ${item.crossroad}` : ""}
                </div>
                <div className={styles.accidentMapStyle40}>
                  {t("common.district")}: {item.district || t("common.unknown")}
                </div>
                <div className={styles.accidentMapStyle41}>
                  {t("common.type")}: {tt(item.type || "incident")}
                </div>
                <div className={styles.accidentMapStyle42}>
                  {t("common.weather")}: {tw(item.weather || "unknown")}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {focusedReportPoint &&
          Number.isFinite(focusedReportPoint.lat) &&
          Number.isFinite(focusedReportPoint.lng) && (
            <CircleMarker
              center={[focusedReportPoint.lat, focusedReportPoint.lng]}
              radius={14}
              pathOptions={{
                color: "#0f172a",
                fillColor: "#ffffff",
                fillOpacity: 0.25,
                weight: 3,
              }}
            />
          )}

        {riskPoint &&
          Number.isFinite(riskPoint.lat) &&
          Number.isFinite(riskPoint.lng) && (
            <CircleMarker
              center={[riskPoint.lat, riskPoint.lng]}
              radius={9}
              pathOptions={{
                color: riskAnalysis
                  ? getRiskColor(riskAnalysis.risk?.level)
                  : "#2563eb",
                fillColor: "#ffffff",
                fillOpacity: 0.9,
                weight: 3,
              }}
            />
          )}
      </MapContainer>

      <RiskAnalysisPanel
        point={riskPoint}
        analysis={riskAnalysis}
        loading={riskLoading}
        error={riskError}
        onClose={closeRiskPanel}
        onReport={openReportAtRiskPoint}
        copy={riskCopy}
        tw={tw}
      />
    </>
  );
}
