import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import {
  Sparkles,
  RefreshCw,
  TriangleAlert,
  MapPin,
  ShieldAlert,
} from "../components/UI/icons";
import Topbar from "../components/UI/Topbar";
import SectionCard from "../components/UI/SectionCard";
import { ASTANA_COORDS } from "../constants/city";
import { useAppStore } from "../store/useAppStore";
import useDistrictsGeojson from "../hooks/useDistrictsGeojson";
import { getForecast } from "../services/aiService";
import { getDistrictLabel, resolveDisplayDistrict } from "../utils/districtUtils";
import { reportError } from "../utils/logger";
import { useI18n } from "../i18n";
import styles from "./Forecast.module.css";

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeWeather(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();

  if (!text) return "unknown";
  if (text.includes("clear")) return "clear";
  if (text.includes("cloud")) return "cloudy";
  if (text.includes("heavy_rain") || text.includes("heavy rain")) return "heavy_rain";
  if (text.includes("rain")) return "rain";
  if (text.includes("snow")) return "snow";
  if (text.includes("ice")) return "ice";
  if (text.includes("fog")) return "fog";
  if (text.includes("storm")) return "storm";
  if (text.includes("hail")) return "hail";
  if (text.includes("strong_wind") || text.includes("strong wind")) return "strong_wind";
  if (text.includes("poor_visibility") || text.includes("poor visibility"))
    return "poor_visibility";
  return "unknown";
}

function normalizeType(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  const normalizedText = `${text} ${text.replaceAll("_", " ")}`;

  if (!text) return "incident";
  if (normalizedText.includes("traffic jam") || normalizedText.includes("jam"))
    return "traffic jam";
  if (normalizedText.includes("rollover")) return "rollover";
  if (normalizedText.includes("pedestrian")) return "pedestrian";
  if (normalizedText.includes("collision")) return "collision";
  if (normalizedText.includes("roadwork") || normalizedText.includes("road work"))
    return "roadwork";
  if (normalizedText.includes("public event") || normalizedText.includes("event"))
    return "public_event";
  if (normalizedText.includes("road closure") || normalizedText.includes("closure"))
    return "road_closure";
  if (normalizedText.includes("stalled vehicle")) return "stalled_vehicle";
  if (normalizedText.includes("police checkpoint")) return "police_checkpoint";
  if (normalizedText.includes("debris")) return "debris";
  if (normalizedText.includes("flooding")) return "flooding";
  return "incident";
}

function normalizeSeverity(value, category = "") {
  const full = `${String(value || "").toLowerCase()} ${String(category || "").toLowerCase()}`;

  if (full.includes("high")) return "high";
  if (full.includes("medium")) return "medium";
  if (full.includes("low")) return "low";
  if (full.includes("traffic jam")) return "medium";
  return "low";
}

function ForecastBox({ title, risk, text, t }) {
  const getBadgeColor = () => {
    if (risk === "HIGH") return "#ef4444";
    if (risk === "MEDIUM") return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div className={styles.forecastStyle1}>
      <div className={styles.forecastStyle2}>{title}</div>

      <div
        style={{
          display: "inline-block",
          background: getBadgeColor(),
          padding: "5px 10px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 800,
          marginBottom: "12px",
        }}
      >
        {t("dashboard.risk", { risk })}
      </div>

      <div className={styles.forecastStyle3}>{text}</div>
    </div>
  );
}

function DangerZoneCard({ zone, index, t }) {
  const badgeColors = ["#f59e0b", "#ef4444", "#f97316"];
  const badgeColor = badgeColors[index % badgeColors.length];

  return (
    <div className={styles.forecastStyle4}>
      <div className={styles.forecastStyle5}>
        <div className={styles.forecastStyle6}>
          <MapPin size={16} color="#94a3b8" />
        </div>

        <div
          style={{
            fontSize: "10px",
            lineHeight: 1.4,
            fontWeight: 800,
            color: badgeColor,
            background: `${badgeColor}18`,
            borderRadius: "999px",
            padding: "4px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {zone.tag || t("forecast.elevatedRiskZone")}
        </div>
      </div>

      <div className={styles.forecastStyle7}>{zone.name}</div>

      <div className={styles.forecastStyle8}>{zone.desc}</div>
    </div>
  );
}

const STYLE_HINTS = [
  "concise analytical",
  "more urgent and cautionary",
  "formal traffic bulletin",
  "clear public safety advisory",
  "short predictive briefing",
  "professional risk assessment",
];

const DEFAULT_DISTRICTS = [
  "Almaty",
  "Esil",
  "Saryarka",
  "Nura",
  "Baikonur",
  "Saraishyk",
];

const DISTRICT_BASE_RISK = {
  Almaty: 18,
  Esil: 16,
  Saryarka: 14,
  Nura: 12,
  Baikonur: 10,
  Saraishyk: 10,
};

const TIME_OPTIONS = [
  { value: "morning", labelKey: "forecast.morning", score: 12 },
  { value: "afternoon", labelKey: "forecast.afternoon", score: 8 },
  { value: "evening", labelKey: "forecast.evening", score: 18 },
  { value: "night", labelKey: "forecast.night", score: 6 },
];

const WEATHER_OPTIONS = [
  { value: "clear", labelKey: "forecast.whatIfWeatherClear", score: 0 },
  { value: "rain", labelKey: "forecast.whatIfWeatherRain", score: 12 },
  { value: "snow", labelKey: "forecast.whatIfWeatherSnow", score: 18 },
  { value: "fog", labelKey: "forecast.whatIfWeatherFog", score: 16 },
  { value: "ice", labelKey: "forecast.whatIfWeatherIce", score: 22 },
];

const TRAFFIC_OPTIONS = [
  { value: "low", labelKey: "forecast.whatIfTrafficLow", score: 4 },
  { value: "medium", labelKey: "forecast.whatIfTrafficMedium", score: 14 },
  { value: "high", labelKey: "forecast.whatIfTrafficHigh", score: 26 },
];

const EVENT_OPTIONS = [
  { value: "traffic_jam", labelKey: "forecast.whatIfEventJam", score: 14 },
  { value: "accident", labelKey: "forecast.whatIfEventAccident", score: 22 },
  { value: "sos", labelKey: "forecast.whatIfEventSos", score: 28 },
  { value: "concert", label: "Concert", score: 18 },
  { value: "match", label: "Match", score: 20 },
  { value: "peak_hour", label: "Rush hour", score: 16 },
  { value: "roadwork", label: "Road repair", score: 12 },
  { value: "closure", label: "Road closure", score: 24 },
];

const VISIBILITY_OPTIONS = [
  { value: "high", label: "HIGH", score: 0 },
  { value: "medium", label: "MEDIUM", score: 6 },
  { value: "low", label: "LOW", score: 14 },
];

const SAFETY_MEASURE_OPTIONS = [
  { value: "speed", label: "Lower speed limit", risk: 8, congestion: 1, delay: 0 },
  { value: "patrol", label: "Add patrol", risk: 5, congestion: 0, delay: 3 },
  { value: "closure", label: "Close road", risk: 10, congestion: -4, delay: -1 },
];

const SCENARIO_PRESETS = [
  {
    value: "snow_peak",
    label: "Snow + rush",
    patch: {
      time: "evening",
      weather: "snow",
      traffic: "high",
      event: "peak_hour",
      visibility: "low",
      roadRepair: false,
      roadClosure: false,
    },
  },
  {
    value: "concert",
    label: "Concert",
    patch: {
      time: "evening",
      weather: "clear",
      traffic: "high",
      event: "concert",
      visibility: "medium",
      roadRepair: false,
      roadClosure: false,
    },
  },
  {
    value: "repair",
    label: "Repair zone",
    patch: {
      time: "afternoon",
      weather: "rain",
      traffic: "medium",
      event: "roadwork",
      visibility: "medium",
      roadRepair: true,
      roadClosure: false,
    },
  },
  {
    value: "match",
    label: "Match",
    patch: {
      time: "evening",
      weather: "clear",
      traffic: "high",
      event: "match",
      visibility: "high",
      roadRepair: false,
      roadClosure: false,
    },
  },
];

const SCENARIO_DISTRICTS = {
  Almaty: [51.130417, 71.498722],
  Esil: [51.099306, 71.454139],
  Saryarka: [51.176694, 71.357194],
  Nura: [51.124639, 71.406694],
  Baikonur: [51.177722, 71.453111],
  Saraishyk: [51.114833, 71.495139],
};

const SCENARIO_ROADS = [
  {
    id: "turan",
    name: "Turan Avenue",
    district: "Nura",
    affinity: ["concert", "peak_hour"],
    positions: [
      [51.1298, 71.3648],
      [51.1301, 71.3714],
      [51.1305, 71.3796],
      [51.131, 71.3879],
      [51.1315, 71.3962],
      [51.1321, 71.405],
    ],
  },
  {
    id: "kabanbay",
    name: "Kabanbay Batyr Avenue",
    district: "Esil",
    affinity: ["match", "peak_hour"],
    positions: [
      [51.1184, 71.4109],
      [51.1235, 71.4122],
      [51.1288, 71.4135],
      [51.134, 71.4151],
      [51.1391, 71.4182],
      [51.1443, 71.4216],
      [51.149, 71.4255],
    ],
  },
  {
    id: "respublika",
    name: "Respublika Avenue",
    district: "Saryarka",
    affinity: ["peak_hour"],
    positions: [
      [51.1518, 71.4304],
      [51.1571, 71.4285],
      [51.1623, 71.4266],
      [51.1673, 71.4245],
      [51.1724, 71.4223],
      [51.1771, 71.4201],
    ],
  },
  {
    id: "abylai",
    name: "Abylai Khan Avenue",
    district: "Almaty",
    affinity: ["roadwork", "closure"],
    positions: [
      [51.1282, 71.4864],
      [51.1325, 71.4876],
      [51.137, 71.4889],
      [51.1421, 71.4902],
      [51.1471, 71.4915],
      [51.1518, 71.4929],
    ],
  },
  {
    id: "uly-dala",
    name: "Mangilik El Avenue",
    district: "Saraishyk",
    affinity: ["concert", "match"],
    positions: [
      [51.092, 71.456],
      [51.096, 71.481],
      [51.101, 71.506],
      [51.107, 71.535],
      [51.113, 71.565],
      [51.119, 71.595],
    ],
  },
  {
    id: "zhengis",
    name: "Zhengis Avenue",
    district: "Baikonur",
    affinity: ["traffic_jam", "peak_hour"],
    positions: [
      [51.1642, 71.4656],
      [51.1611, 71.4632],
      [51.1582, 71.461],
      [51.1548, 71.4584],
      [51.1512, 71.4556],
      [51.1478, 71.4531],
    ],
  },
];

const SCENARIO_SAFE_ROUTE = [
  [51.1454, 71.4018],
  [51.1467, 71.4095],
  [51.1484, 71.4172],
  [51.1504, 71.4251],
  [51.1538, 71.4305],
  [51.1588, 71.4345],
];

const SCENARIO_SERVICE_POINTS = [
  { name: "Patrol unit", center: [51.139, 71.371] },
  { name: "EMS unit", center: [51.112, 71.436] },
];

const SCENARIO_EVENT_MARKERS = {
  traffic_jam: { code: "JAM" },
  accident: { code: "DTP" },
  sos: { code: "SOS" },
  concert: { code: "EV" },
  match: { code: "EV" },
  peak_hour: { code: "RH" },
  roadwork: { code: "RW" },
  closure: { code: "CL" },
};

const SCENARIO_COPY = {
  ru: {
    presets: {
      snow_peak: "Снег + час пик",
      concert: "Концерт",
      repair: "Ремонт дороги",
      match: "Матч",
    },
    events: {
      traffic_jam: "Пробка",
      accident: "ДТП",
      sos: "SOS-заявка",
      concert: "Концерт",
      match: "Матч",
      peak_hour: "Час пик",
      roadwork: "Ремонт дороги",
      closure: "Перекрытие",
    },
    visibility: {
      high: "Высокая",
      medium: "Средняя",
      low: "Низкая",
    },
    safety: {
      speed: "Снизить скорость",
      patrol: "Добавить патруль",
      closure: "Закрыть участок",
    },
    levels: {
      HIGH: "Высокий",
      MEDIUM: "Средний",
      LOW: "Низкий",
    },
    shortLevels: {
      HIGH: "ВЫСОКИЙ",
      MEDIUM: "СРЕДНИЙ",
      LOW: "НИЗКИЙ",
    },
    readyScenarios: "Готовые сценарии",
    visibilityTitle: "Видимость",
    roadRepair: "Ремонт дороги",
    streetClosure: "Перекрытие улицы",
    applySafetyMeasure: "Меры безопасности",
    mapTitle: "Карта AI-прогноза",
    congestion: "нагрузка",
    delay: "задержка",
    mapForecast: "AI-прогноз карты",
    heatZone: "зона риска",
    safeCorridor: "безопасный коридор",
    roadBlock: "перекрытие",
    closed: "закрыто",
    predictedCongestion: "Прогноз пробок",
    emergencyDelay: "Задержка служб",
    collisions: "Вероятность ДТП",
    beforeAfterTitle: "Эффект мер реагирования",
    before: "До мер",
    after: "После мер",
    riskReduced: "риск",
    delayReduced: "задержка",
    factorsTitle: "Почему AI так решил",
    dataTitle: "Достоверность данных",
    basedOn: "Основано на",
    updated: "Обновлено сейчас",
    reports: "отчетов",
    weatherTraffic: "погоде, трафике и событиях",
    missionTitle: "Смысл AI-прогноза",
    missionText:
      "Система заранее показывает риск ДТП, нагрузку на службы и помогает выбрать меры до ухудшения ситуации.",
    safetyMeasureFactor: "Меры реагирования",
    roadWorksFactor: "Дорожные работы",
    eventImpactZone: "зона влияния сценария",
    predictedLoad: "Прогноз нагрузки",
    controlledClosure: "Контролируемое перекрытие",
    safeWaypoint: "Рекомендованная безопасная точка",
    safeRouteTitle: "Безопасный коридор",
    serviceNode: "Узел экстренной службы",
    serviceNodeText: "Готовность к реагированию",
    patrolUnit: "Патруль",
    emsUnit: "Скорая помощь",
    minuteShort: "мин",
    noMeasuresText: "Выберите меры слева, чтобы увидеть снижение риска и задержки.",
    zoneDescription: ({ total, jams, high, weather }) =>
      `${total} отчетов зафиксировано здесь` +
      (jams > 0 ? `, включая ${jams} активных отметок пробок` : "") +
      (high > 0 ? ` и ${high} серьезных инцидентов` : "") +
      `. Главное условие: ${weather}.`,
    noDistrictAnalysis:
      "Районный анализ ограничен: для выбранной даты недостаточно отчетов с привязкой к районам.",
    fallbackInsight: ({ district, totalReports, activeJams }) =>
      `Текущая дорожная картина Астаны показывает наибольшее давление безопасности в районе ${district}. Всего отчетов: ${totalReports}, активных пробок: ${activeJams}, поэтому во второй половине дня нужна повышенная осторожность.`,
    fallbackReasoning: ({ district, total, jams, collisions, high, weather }) =>
      `Самый активный район: ${district}, событий на карте: ${total}. Главные факторы: ${jams} активных пробок, ${collisions} столкновений и ${high} серьезных событий при условии ${weather}.`,
    fallbackRecommendation:
      "Продолжайте отслеживать пользовательские отчеты и исторические инциденты, чтобы улучшить районный прогноз.",
    districtRecommendation: ({ district }) =>
      `Снизьте скорость, увеличьте дистанцию и будьте особенно внимательны в районе ${district}, где дорожная нагрузка сейчас выше всего.`,
  },
  en: {
    presets: {
      snow_peak: "Snow + rush",
      concert: "Concert",
      repair: "Road repair",
      match: "Match",
    },
    events: {
      traffic_jam: "Traffic jam",
      accident: "Accident",
      sos: "SOS request",
      concert: "Concert",
      match: "Match",
      peak_hour: "Rush hour",
      roadwork: "Road repair",
      closure: "Road closure",
    },
    visibility: {
      high: "High",
      medium: "Medium",
      low: "Low",
    },
    safety: {
      speed: "Lower speed limit",
      patrol: "Add patrol",
      closure: "Close road",
    },
    levels: {
      HIGH: "High",
      MEDIUM: "Medium",
      LOW: "Low",
    },
    shortLevels: {
      HIGH: "HIGH",
      MEDIUM: "MEDIUM",
      LOW: "LOW",
    },
    readyScenarios: "Ready scenarios",
    visibilityTitle: "Visibility",
    roadRepair: "Road repair",
    streetClosure: "Street closure",
    applySafetyMeasure: "Safety measures",
    mapTitle: "AI forecast map",
    congestion: "congestion",
    delay: "delay",
    mapForecast: "AI map forecast",
    heatZone: "risk zone",
    safeCorridor: "safe corridor",
    roadBlock: "road block",
    closed: "closed",
    predictedCongestion: "Predicted congestion",
    emergencyDelay: "Emergency delay",
    collisions: "Collision probability",
    beforeAfterTitle: "Safety measure impact",
    before: "Before",
    after: "After",
    riskReduced: "risk",
    delayReduced: "delay",
    factorsTitle: "Why AI decided this",
    dataTitle: "Data confidence",
    basedOn: "Based on",
    updated: "Updated now",
    reports: "reports",
    weatherTraffic: "weather, traffic, and events",
    missionTitle: "AI forecast purpose",
    missionText:
      "The system shows accident risk, service pressure, and response options before the situation gets worse.",
    safetyMeasureFactor: "Safety measures",
    roadWorksFactor: "Road works",
    eventImpactZone: "scenario impact zone",
    predictedLoad: "Predicted load",
    controlledClosure: "Controlled closure",
    safeWaypoint: "Recommended low-risk waypoint",
    safeRouteTitle: "Safe corridor",
    serviceNode: "Emergency service node",
    serviceNodeText: "Response readiness",
    patrolUnit: "Patrol unit",
    emsUnit: "EMS unit",
    minuteShort: "min",
    noMeasuresText: "Select safety measures on the left to see risk and delay reduction.",
    zoneDescription: ({ total, jams, high, weather }) =>
      `${total} total reports recorded here` +
      (jams > 0 ? `, including ${jams} active jam reports` : "") +
      (high > 0 ? ` and ${high} high-severity incidents` : "") +
      `. Main condition: ${weather}.`,
    noDistrictAnalysis:
      "District-based analysis is limited because not enough reports could be mapped to districts for the selected date.",
    fallbackInsight: ({ district, totalReports, activeJams }) =>
      `Astana's current traffic pattern suggests the greatest safety pressure is concentrated in ${district} district. Because there are ${totalReports} total reports and ${activeJams} active jam reports, extra caution is recommended later in the day.`,
    fallbackReasoning: ({ district, total, jams, collisions, high, weather }) =>
      `The busiest district is ${district}, with ${total} mapped incidents. The most influential factors are ${jams} active jam reports, ${collisions} collision-type incidents, and ${high} high-severity events under mostly ${weather} conditions.`,
    fallbackRecommendation:
      "Continue monitoring user reports and historical incidents to improve district-level forecasting accuracy.",
    districtRecommendation: ({ district }) =>
      `Reduce speed, increase following distance, and be especially careful in ${district} district, where traffic pressure is currently the strongest.`,
  },
  kz: {
    presets: {
      snow_peak: "Қар + қарбалас",
      concert: "Концерт",
      repair: "Жол жөндеу",
      match: "Матч",
    },
    events: {
      traffic_jam: "Кептеліс",
      accident: "ЖКО",
      sos: "SOS өтінімі",
      concert: "Концерт",
      match: "Матч",
      peak_hour: "Қарбалас уақыт",
      roadwork: "Жол жөндеу",
      closure: "Жол жабу",
    },
    visibility: {
      high: "Жоғары",
      medium: "Орташа",
      low: "Төмен",
    },
    safety: {
      speed: "Жылдамдықты азайту",
      patrol: "Патруль қосу",
      closure: "Учаскені жабу",
    },
    levels: {
      HIGH: "Жоғары",
      MEDIUM: "Орташа",
      LOW: "Төмен",
    },
    shortLevels: {
      HIGH: "ЖОҒАРЫ",
      MEDIUM: "ОРТАША",
      LOW: "ТӨМЕН",
    },
    readyScenarios: "Дайын сценарийлер",
    visibilityTitle: "Көріну",
    roadRepair: "Жол жөндеу",
    streetClosure: "Көшені жабу",
    applySafetyMeasure: "Қауіпсіздік шаралары",
    mapTitle: "AI-болжам картасы",
    congestion: "жүктеме",
    delay: "кідіріс",
    mapForecast: "Карта AI-болжамы",
    heatZone: "тәуекел аймағы",
    safeCorridor: "қауіпсіз дәліз",
    roadBlock: "жол жабылуы",
    closed: "жабық",
    predictedCongestion: "Кептеліс болжамы",
    emergencyDelay: "Қызметтердің кідірісі",
    collisions: "ЖКО ықтималдығы",
    beforeAfterTitle: "Әрекет шараларының әсері",
    before: "Дейін",
    after: "Кейін",
    riskReduced: "тәуекел",
    delayReduced: "кідіріс",
    factorsTitle: "AI неге осылай шешті",
    dataTitle: "Дерек сенімділігі",
    basedOn: "Негізделген",
    updated: "Жаңа жаңартылды",
    reports: "есеп",
    weatherTraffic: "ауа райына, трафикке және оқиғаларға",
    missionTitle: "AI-болжам мақсаты",
    missionText:
      "Жүйе жағдай нашарламай тұрып ЖКО тәуекелін, қызметтерге түсетін жүктемені және әрекет нұсқаларын көрсетеді.",
    safetyMeasureFactor: "Әрекет шаралары",
    roadWorksFactor: "Жол жұмыстары",
    eventImpactZone: "сценарий әсер аймағы",
    predictedLoad: "Жүктеме болжамы",
    controlledClosure: "Бақыланатын жабу",
    safeWaypoint: "Ұсынылған қауіпсіз нүкте",
    safeRouteTitle: "Қауіпсіз дәліз",
    serviceNode: "Шұғыл қызмет торабы",
    serviceNodeText: "Әрекет ету дайындығы",
    patrolUnit: "Патруль",
    emsUnit: "Жедел жәрдем",
    minuteShort: "мин",
    noMeasuresText:
      "Тәуекел мен кідірістің азаюын көру үшін сол жақтан қауіпсіздік шараларын таңдаңыз.",
    zoneDescription: ({ total, jams, high, weather }) =>
      `${total} есеп осы жерде тіркелді` +
      (jams > 0 ? `, соның ішінде ${jams} белсенді кептеліс белгісі` : "") +
      (high > 0 ? ` және ${high} ауыр оқиға` : "") +
      `. Негізгі жағдай: ${weather}.`,
    noDistrictAnalysis:
      "Райондық талдау шектеулі: таңдалған күнде райондарға байланыстырылған есептер жеткіліксіз.",
    fallbackInsight: ({ district, totalReports, activeJams }) =>
      `Астанадағы қазіргі жол жағдайы ең жоғары қауіпсіздік қысымы ${district} ауданында екенін көрсетеді. Барлығы ${totalReports} есеп және ${activeJams} белсенді кептеліс бар, сондықтан күннің кейінгі бөлігінде қосымша сақтық қажет.`,
    fallbackReasoning: ({ district, total, jams, collisions, high, weather }) =>
      `Ең белсенді аудан: ${district}, картаға түскен оқиға саны: ${total}. Негізгі факторлар: ${jams} белсенді кептеліс, ${collisions} соқтығыс түріндегі оқиға және ${high} ауыр оқиға, негізгі жағдай: ${weather}.`,
    fallbackRecommendation:
      "Райондық болжам дәлдігін жақсарту үшін пайдаланушы есептері мен тарихи оқиғаларды бақылауды жалғастырыңыз.",
    districtRecommendation: ({ district }) =>
      `${district} ауданында жол жүктемесі ең жоғары болғандықтан, жылдамдықты азайтып, арақашықтықты ұлғайтып, ерекше сақ болыңыз.`,
  },
};

function getScenarioCopy(language) {
  return SCENARIO_COPY[language] || SCENARIO_COPY.ru;
}

function getScenarioLevel(score) {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function formatSigned(value) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function getOptionLabel(option, t) {
  return option?.labelKey ? t(option.labelKey) : option?.label || option?.value;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getRoadColor(score) {
  if (score >= 78) return "#dc2626";
  if (score >= 56) return "#f97316";
  if (score >= 36) return "#f59e0b";
  return "#2563eb";
}

function getScenarioTone(score) {
  if (score >= 78) return "high";
  if (score >= 56) return "medium";
  return "low";
}

function getScenarioToneClass(tone) {
  if (tone === "closed") return styles.scenarioMarkerClosed;
  if (tone === "high") return styles.scenarioMarkerHigh;
  if (tone === "medium") return styles.scenarioMarkerMedium;
  return styles.scenarioMarkerLow;
}

function getRoutePoint(positions, ratio = 0.5) {
  if (!positions?.length) return [ASTANA_COORDS.lat, ASTANA_COORDS.lng];

  const index = clamp(
    Math.round((positions.length - 1) * ratio),
    0,
    positions.length - 1,
  );

  return positions[index];
}

function getDistrictNameFromFeature(feature) {
  const properties = feature?.properties || {};
  const candidates = [
    properties.name_object,
    properties.name_object_kaz,
    properties.district_en,
    properties.DISTRICT_EN,
    properties.name_en,
    properties.NAME_EN,
    properties["name:en"],
    properties.official_name,
    properties.OFFICIAL_NAME,
    properties.name_ru,
    properties.NAME_RU,
    properties["name:ru"],
    properties.name_kk,
    properties.NAME_KK,
    properties["name:kk"],
    properties.district,
    properties.DISTRICT,
    properties.name,
    properties.NAME,
    properties.Name,
    properties.label,
    properties.LABEL,
    properties.region,
  ];

  for (const value of candidates) {
    const district = getDistrictLabel(value);
    if (district !== "Unknown") return district;
  }

  return "Unknown";
}

function geometryToOuterRings(geometry) {
  if (!geometry?.coordinates) return [];

  const toLatLngRing = (ring = []) =>
    ring
      .map((point) => [Number(point?.[1]), Number(point?.[0])])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (geometry.type === "Polygon") {
    return [toLatLngRing(geometry.coordinates[0])].filter(
      (ring) => ring.length >= 3,
    );
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => toLatLngRing(polygon?.[0]))
      .filter((ring) => ring.length >= 3);
  }

  return [];
}

function getSelectedDistrictRings(geojson, district) {
  if (!geojson?.features?.length || !district) return [];

  return geojson.features
    .filter((feature) => getDistrictNameFromFeature(feature) === district)
    .flatMap((feature) => geometryToOuterRings(feature.geometry));
}

function createScenarioMarkerIcon(signal) {
  const markerClass = [
    styles.scenarioMarker,
    getScenarioToneClass(signal.tone),
  ].join(" ");

  return divIcon({
    className: styles.scenarioDivIcon,
    html: `
      <div class="${markerClass}">
        <span>${signal.code}</span>
        <strong>${signal.score}</strong>
      </div>
    `,
    iconSize: [66, 48],
    iconAnchor: [33, 42],
    popupAnchor: [0, -36],
  });
}

function getRiskMeta(score) {
  if (score >= 75) {
    return {
      level: "HIGH",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.12)",
    };
  }

  if (score >= 45) {
    return {
      level: "MEDIUM",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.14)",
    };
  }

  return {
    level: "LOW",
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.12)",
  };
}

function findOption(options, value) {
  return options.find((item) => item.value === value) || options[0];
}

function ScenarioMapFocus({ center, riskScore }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.invalidateSize();
    map.flyTo(center, riskScore >= 75 ? 12 : 11, { duration: 0.55 });
  }, [center, map, riskScore]);

  return null;
}

function ScenarioMapResize() {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize();
    const frame = requestAnimationFrame(resize);
    const timers = [120, 360, 760].map((delay) => setTimeout(resize, delay));

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => clearTimeout(timer));
      window.removeEventListener("resize", resize);
    };
  }, [map]);

  return null;
}

function ForecastScenarioMap({
  center,
  dangerZones,
  mapSignals,
  riskScore,
  selectedDistrictRings = [],
  copy,
}) {
  return (
    <MapContainer
      center={center}
      zoom={11}
      className={styles.scenarioMap}
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ScenarioMapResize />
      <ScenarioMapFocus center={center} riskScore={riskScore} />

      {selectedDistrictRings.map((ring, index) => (
        <Polygon
          key={`selected-district-${index}`}
          positions={ring}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.045,
            opacity: 0.55,
            weight: 2,
            dashArray: "7 7",
          }}
        />
      ))}

      {dangerZones.map((zone) => (
        <Fragment key={zone.name}>
          <Circle
            center={zone.center}
            radius={zone.radius * 1.55}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.055,
              opacity: 0,
              weight: 0,
            }}
          />
          <Circle
            center={zone.center}
            radius={zone.radius}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.14,
              opacity: 0.24,
              weight: 1,
            }}
          />
          <CircleMarker
            center={zone.center}
            radius={Math.max(9, Math.min(16, zone.score / 6))}
            pathOptions={{
              color: "#ffffff",
              fillColor: zone.color,
              fillOpacity: 0.94,
              opacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <div className={styles.scenarioPopup}>
                <strong>{zone.name}</strong>
                <span>{copy.heatZone} {zone.score}/100</span>
              </div>
            </Popup>
          </CircleMarker>
        </Fragment>
      ))}

      {SCENARIO_SAFE_ROUTE.map((point, index) => (
        <CircleMarker
          key={`${point[0]}-${point[1]}`}
          center={point}
          radius={index === SCENARIO_SAFE_ROUTE.length - 1 ? 7 : 5}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#10b981",
            fillOpacity: 0.95,
            opacity: 1,
            weight: 2,
          }}
        >
          <Popup>
              <div className={styles.scenarioPopup}>
                <strong>{copy.safeRouteTitle}</strong>
                <span>{copy.safeWaypoint}</span>
              </div>
          </Popup>
        </CircleMarker>
      ))}

      {mapSignals.map((signal) => (
        <Marker
          key={signal.id}
          position={signal.center}
          icon={createScenarioMarkerIcon(signal)}
        >
          <Popup>
            <div className={styles.scenarioPopup}>
              <strong>{signal.title}</strong>
              <span>{signal.description}</span>
            </div>
          </Popup>
        </Marker>
      ))}

      {SCENARIO_SERVICE_POINTS.map((point) => (
        <CircleMarker
          key={point.name}
          center={point.center}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 0.95,
            opacity: 1,
            weight: 2,
          }}
        >
          <Popup>
              <div className={styles.scenarioPopup}>
              <strong>{point.name === "Patrol unit" ? copy.patrolUnit : copy.emsUnit}</strong>
              <span>{copy.serviceNodeText}</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}

    </MapContainer>
  );
}

function RoadScenarioPlanner({
  districtOptions,
  districtStats,
  districtsGeojson,
  scenario,
  setScenario,
  language,
  t,
}) {
  const copy = getScenarioCopy(language);
  const selectedTime = findOption(TIME_OPTIONS, scenario.time);
  const selectedWeather = findOption(WEATHER_OPTIONS, scenario.weather);
  const selectedTraffic = findOption(TRAFFIC_OPTIONS, scenario.traffic);
  const selectedEvent = findOption(EVENT_OPTIONS, scenario.event);
  const selectedVisibility = findOption(VISIBILITY_OPTIONS, scenario.visibility);
  const activeMeasures = Array.isArray(scenario.measures) ? scenario.measures : [];
  const selectedDistrictStats = districtStats[scenario.district] || {
    total: 0,
    high: 0,
    jams: 0,
  };

  const districtScore = DISTRICT_BASE_RISK[scenario.district] || 11;
  const liveDataScore = Math.min(
    26,
    selectedDistrictStats.total * 2 +
      selectedDistrictStats.high * 8 +
      selectedDistrictStats.jams * 5,
  );
  const repairScore = scenario.roadRepair ? 9 : 0;
  const closureScore = scenario.roadClosure ? 16 : 0;
  const measureImpact = activeMeasures.reduce(
    (acc, measureId) => {
      const measure = SAFETY_MEASURE_OPTIONS.find((item) => item.value === measureId);
      if (!measure) return acc;

      return {
        risk: acc.risk + measure.risk,
        congestion: acc.congestion + measure.congestion,
        delay: acc.delay + measure.delay,
      };
    },
    { risk: 0, congestion: 0, delay: 0 },
  );

  const rawScore =
    districtScore +
    selectedTime.score +
    selectedWeather.score +
    selectedTraffic.score +
    selectedEvent.score +
    selectedVisibility.score +
    repairScore +
    closureScore +
    liveDataScore;

  const riskBefore = clamp(rawScore, 0, 100);
  const riskScore = clamp(rawScore - measureImpact.risk, 0, 100);
  const riskMeta = getRiskMeta(riskScore);
  const congestionBefore = clamp(
    18 +
      selectedTraffic.score * 2 +
      selectedEvent.score +
      selectedWeather.score +
      repairScore +
      closureScore +
      liveDataScore,
  );
  const congestionScore = clamp(
    congestionBefore - measureImpact.congestion,
  );
  const emergencyDelayBefore = Math.max(
    0,
    Math.round(
      2 +
        congestionBefore / 8 +
        selectedVisibility.score / 6 +
        repairScore / 4,
    ),
  );
  const emergencyDelay = Math.max(
    0,
    Math.round(
      2 +
        congestionScore / 8 +
        selectedVisibility.score / 6 +
        repairScore / 4 -
        measureImpact.delay,
    ),
  );
  const collisionBefore = clamp(
    24 +
      selectedWeather.score +
      selectedTraffic.score +
      selectedVisibility.score +
      selectedEvent.score * 0.72 +
      closureScore * 0.6,
  );
  const collisionScore = clamp(
    collisionBefore - measureImpact.risk * 0.6,
  );
  const riskDelta = Math.max(0, Math.round(riskBefore - riskScore));
  const delayDelta = Math.max(0, emergencyDelayBefore - emergencyDelay);
  const confidence = Math.min(
    92,
    58 +
      selectedDistrictStats.total * 3 +
      selectedDistrictStats.high * 5 +
      selectedDistrictStats.jams * 4,
  );
  const mapCenter =
    SCENARIO_DISTRICTS[scenario.district] || [
      ASTANA_COORDS.lat,
      ASTANA_COORDS.lng,
    ];
  const selectedDistrictRings = useMemo(
    () => getSelectedDistrictRings(districtsGeojson, scenario.district),
    [districtsGeojson, scenario.district],
  );

  const scenarioRoads = SCENARIO_ROADS.map((road) => {
    const selectedDistrictBoost = road.district === scenario.district ? 16 : 0;
    const affinityBoost = road.affinity.includes(scenario.event) ? 14 : 0;
    const weatherBoost =
      ["snow", "ice", "fog"].includes(scenario.weather) ? 7 : 0;
    const roadworkBoost =
      scenario.roadRepair && road.affinity.includes("roadwork") ? 12 : 0;
    const closed = scenario.roadClosure && road.district === scenario.district;
    const score = clamp(
      Math.round(
        16 +
          congestionScore * 0.46 +
          selectedDistrictBoost +
          affinityBoost +
          weatherBoost +
          roadworkBoost +
          (closed ? 18 : 0),
      ),
    );

    return {
      ...road,
      score,
      closed,
    };
  }).sort((a, b) => b.score - a.score);

  const triggerRoad =
    scenarioRoads.find((road) => road.affinity.includes(scenario.event)) ||
    scenarioRoads[0];
  const repairRoad =
    scenarioRoads.find((road) => road.affinity.includes("roadwork")) ||
    scenarioRoads[0];
  const closureRoad =
    scenarioRoads.find((road) => road.district === scenario.district) ||
    scenarioRoads[0];
  const triggerMeta = SCENARIO_EVENT_MARKERS[scenario.event] || { code: "AI" };
  const mapSignals = [
    ...scenarioRoads.slice(0, 3).map((road, index) => ({
      id: `risk-${road.id}`,
      center: getRoutePoint(road.positions, index === 1 ? 0.6 : 0.45),
      code: road.closed ? "CL" : "AI",
      score: road.score,
      tone: road.closed ? "closed" : getScenarioTone(road.score),
      title: road.name,
      description: road.closed
        ? copy.controlledClosure
        : `${copy.predictedLoad} ${road.score}/100`,
    })),
    {
      id: "scenario-trigger",
      center: getRoutePoint(triggerRoad?.positions, 0.56),
      code: triggerMeta.code,
      score: selectedEvent.score,
      tone: getScenarioTone(riskScore),
      title: copy.events[scenario.event] || getOptionLabel(selectedEvent, t),
      description: copy.eventImpactZone,
    },
    scenario.roadRepair
      ? {
          id: "road-repair-signal",
          center: getRoutePoint(repairRoad?.positions, 0.72),
          code: "RW",
          score: repairScore,
          tone: "medium",
          title: copy.roadRepair,
          description: copy.roadWorksFactor,
        }
      : null,
    scenario.roadClosure
      ? {
          id: "road-closure-signal",
          center: getRoutePoint(closureRoad?.positions, 0.34),
          code: "CL",
          score: closureScore,
          tone: "closed",
          title: copy.streetClosure,
          description: copy.controlledClosure,
        }
      : null,
  ].filter(Boolean);

  const dangerZones = Object.entries(SCENARIO_DISTRICTS)
    .map(([name, center]) => {
      const stats = districtStats[name] || { total: 0, high: 0, jams: 0 };
      const selectedBoost = name === scenario.district ? 22 : 0;
      const score = clamp(
        Math.round(
          18 +
            riskScore * 0.42 +
            selectedBoost +
            stats.high * 5 +
            stats.jams * 3 +
            stats.total,
        ),
      );

      return {
        name,
        center,
        score,
        radius: 540 + score * 11,
        color: getRiskMeta(score).color,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const breakdown = [
    {
      key: "district",
      label: t("forecast.whatIfFactorDistrict"),
      value: districtScore,
      color: "#2563eb",
    },
    {
      key: "time",
      label: t("forecast.whatIfFactorTime"),
      value: selectedTime.score,
      color: "#8b5cf6",
    },
    {
      key: "weather",
      label: t("forecast.whatIfFactorWeather"),
      value: selectedWeather.score,
      color: "#0ea5e9",
    },
    {
      key: "traffic",
      label: t("forecast.whatIfFactorTraffic"),
      value: selectedTraffic.score,
      color: "#f59e0b",
    },
    {
      key: "event",
      label: t("forecast.whatIfFactorEvent"),
      value: selectedEvent.score,
      color: "#ef4444",
    },
    {
      key: "visibility",
      label: copy.visibilityTitle,
      value: selectedVisibility.score,
      color: "#64748b",
    },
    {
      key: "repair",
      label: copy.roadWorksFactor,
      value: repairScore + closureScore,
      color: "#111827",
    },
    {
      key: "live",
      label: t("forecast.whatIfFactorLiveData"),
      value: liveDataScore,
      color: "#10b981",
    },
    activeMeasures.length
      ? {
          key: "measures",
          label: copy.safetyMeasureFactor,
          value: -measureImpact.risk,
          color: "#059669",
        }
      : null,
  ].filter(Boolean);

  const adviceKey =
    riskMeta.level === "HIGH"
      ? "forecast.whatIfAdviceHigh"
      : riskMeta.level === "MEDIUM"
        ? "forecast.whatIfAdviceMedium"
        : "forecast.whatIfAdviceLow";

  const summaryItems = [
    scenario.district,
    t(selectedTime.labelKey),
    t(selectedWeather.labelKey),
    t(selectedTraffic.labelKey),
    copy.events[scenario.event] || getOptionLabel(selectedEvent, t),
    copy.visibility[scenario.visibility],
    scenario.roadRepair ? copy.roadRepair : null,
    scenario.roadClosure ? copy.streetClosure : null,
    activeMeasures.length ? `${activeMeasures.length} ${copy.applySafetyMeasure}` : null,
  ].filter(Boolean);

  const congestionLevel = copy.shortLevels[getScenarioLevel(congestionScore)];
  const collisionLevel = copy.shortLevels[getScenarioLevel(collisionScore)];
  const beforeLevel = copy.levels[getScenarioLevel(riskBefore)];
  const afterLevel = copy.levels[getScenarioLevel(riskScore)];

  const updateScenario = (key, value) => {
    setScenario((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset) => {
    setScenario((prev) => ({ ...prev, ...preset.patch }));
  };

  const toggleMeasure = (measureId) => {
    setScenario((prev) => {
      const current = Array.isArray(prev.measures) ? prev.measures : [];
      const measures = current.includes(measureId)
        ? current.filter((item) => item !== measureId)
        : [...current, measureId];

      return { ...prev, measures };
    });
  };

  return (
    <SectionCard className={styles.whatIfCard}>
      <div className={styles.whatIfHeader}>
        <div>
          <div className={styles.whatIfEyebrow}>
            {t("forecast.whatIfEyebrow")}
          </div>
          <h2>{t("forecast.whatIfTitle")}</h2>
          <p>{t("forecast.whatIfSubtitle")}</p>
        </div>

        <div
          className={styles.scenarioMeter}
          style={{
            "--risk-color": riskMeta.color,
            "--risk-score": `${riskScore}%`,
          }}
        >
          <div className={styles.scenarioMeterTop}>
            <span>{t("forecast.whatIfScore")}</span>
            <strong>{riskScore}</strong>
          </div>
          <div className={styles.scenarioMeterTrack}>
            <i />
          </div>
          <div className={styles.scenarioMeterMeta}>
            <span>{t("forecast.riskLevel")}</span>
            <b style={{ color: riskMeta.color }}>{copy.shortLevels[riskMeta.level]}</b>
          </div>
        </div>
      </div>

      <div className={styles.scenarioSummary}>
        {summaryItems.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>

      <div className={styles.scenarioMission}>
        <Sparkles size={18} />
        <div>
          <strong>{copy.missionTitle}</strong>
          <span>{copy.missionText}</span>
        </div>
        <div className={styles.scenarioDataPill}>
          <span>{copy.basedOn}</span>
          <strong>
            {selectedDistrictStats.total} {copy.reports}
          </strong>
        </div>
      </div>

      <div className={styles.whatIfGrid}>
        <div className={styles.scenarioControls}>
          <div className={styles.controlGroup}>
            <span>{copy.readyScenarios}</span>
            <div className={styles.quickScenarioGrid}>
              {SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPreset(preset)}
                >
                  {copy.presets[preset.value] || preset.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            {t("forecast.whatIfDistrict")}
            <select
              value={scenario.district}
              onChange={(event) => updateScenario("district", event.target.value)}
            >
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.controlGroup}>
            <span>{t("forecast.whatIfTime")}</span>
            <div className={styles.segmentedControl}>
              {TIME_OPTIONS.map((item) => {
                const active = scenario.time === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateScenario("time", item.value)}
                    className={active ? styles.segmentActive : ""}
                  >
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <span>{t("forecast.whatIfWeather")}</span>
            <div className={styles.weatherButtons}>
              {WEATHER_OPTIONS.map((item) => {
                const active = scenario.weather === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateScenario("weather", item.value)}
                    className={active ? styles.eventActive : ""}
                  >
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.controlRow}>
            <label>
              {t("forecast.whatIfTraffic")}
              <select
                value={scenario.traffic}
                onChange={(event) =>
                  updateScenario("traffic", event.target.value)
                }
              >
                {TRAFFIC_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.controlGroup}>
            <span>{t("forecast.whatIfEvent")}</span>
            <div className={styles.eventButtons}>
              {EVENT_OPTIONS.map((item) => {
                const active = scenario.event === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateScenario("event", item.value)}
                    className={active ? styles.eventActive : ""}
                  >
                    {copy.events[item.value] || getOptionLabel(item, t)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <span>{copy.visibilityTitle}</span>
            <div className={styles.visibilityButtons}>
              {VISIBILITY_OPTIONS.map((item) => {
                const active = scenario.visibility === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateScenario("visibility", item.value)}
                    className={active ? styles.eventActive : ""}
                  >
                    {copy.visibility[item.value] || item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.toggleGrid}>
            <button
              type="button"
              className={scenario.roadRepair ? styles.eventActive : ""}
              onClick={() => updateScenario("roadRepair", !scenario.roadRepair)}
            >
              {copy.roadRepair}
            </button>
            <button
              type="button"
              className={scenario.roadClosure ? styles.eventActive : ""}
              onClick={() => updateScenario("roadClosure", !scenario.roadClosure)}
            >
              {copy.streetClosure}
            </button>
          </div>

          <div className={styles.controlGroup}>
            <span>{copy.applySafetyMeasure}</span>
            <div className={styles.safetyButtons}>
              {SAFETY_MEASURE_OPTIONS.map((item) => {
                const active = activeMeasures.includes(item.value);

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => toggleMeasure(item.value)}
                    className={active ? styles.safetyActive : ""}
                  >
                    {copy.safety[item.value] || item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.scenarioMapPanel}>
          <div className={styles.scenarioMapHeader}>
            <div>
              <span>{copy.mapTitle}</span>
              <strong>{scenario.district}</strong>
            </div>
            <div className={styles.mapStats}>
              <span>{congestionScore}/100 {copy.congestion}</span>
              <span>+{emergencyDelay} {copy.minuteShort} {copy.delay}</span>
            </div>
          </div>

          <div className={styles.scenarioMapWrap}>
            <ForecastScenarioMap
              center={mapCenter}
              dangerZones={dangerZones}
              mapSignals={mapSignals}
              riskScore={riskScore}
              selectedDistrictRings={selectedDistrictRings}
              copy={copy}
            />

            <div className={styles.mapRiskBadge}>
              <span>{copy.mapForecast}</span>
              <strong style={{ color: riskMeta.color }}>
                {copy.shortLevels[riskMeta.level]}
              </strong>
              <em>{riskScore}/100</em>
            </div>

            <div className={styles.mapLegendCompact}>
              <span>
                <i className={styles.legendDanger} />
                {copy.heatZone}
              </span>
              <span>
                <i className={styles.legendSafe} />
                {copy.safeCorridor}
              </span>
              <span>
                <i className={styles.legendClosed} />
                {copy.roadBlock}
              </span>
            </div>
          </div>

          <div className={styles.pressureRoadList}>
            {scenarioRoads.slice(0, 3).map((road) => (
              <div key={road.id} className={styles.pressureRoadRow}>
                <span>{road.name}</span>
                <strong style={{ color: getRoadColor(road.score) }}>
                  {road.closed ? copy.closed : `${road.score}/100`}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.simulationResult}>
          <div className={styles.riskResult} style={{ background: riskMeta.bg }}>
            <div>
              <span>{t("forecast.riskLevel")}</span>
              <strong style={{ color: riskMeta.color }}>
                {copy.shortLevels[riskMeta.level]}
              </strong>
            </div>
            <div className={styles.confidencePill}>
              {t("forecast.whatIfConfidence", { value: confidence })}
            </div>
          </div>

          <div className={styles.beforeAfterPanel}>
            <div className={styles.resultSectionTitle}>{copy.beforeAfterTitle}</div>
            <div className={styles.beforeAfterGrid}>
              <div>
                <span>{copy.before}</span>
                <strong>{riskBefore}</strong>
                <em>{beforeLevel}</em>
              </div>
              <div className={styles.afterCard}>
                <span>{copy.after}</span>
                <strong>{riskScore}</strong>
                <em>{afterLevel}</em>
              </div>
            </div>
            <p className={!activeMeasures.length ? styles.noMeasureHint : ""}>
              {activeMeasures.length
                ? `-${riskDelta} ${copy.riskReduced} / -${delayDelta} ${copy.minuteShort} ${copy.delayReduced}`
                : copy.noMeasuresText}
            </p>
          </div>

          <div className={styles.resultMetrics}>
            <div>
              <span>{copy.predictedCongestion}</span>
              <strong>{congestionLevel}</strong>
            </div>
            <div>
              <span>{copy.emergencyDelay}</span>
              <strong>+{emergencyDelay} {copy.minuteShort}</strong>
            </div>
            <div>
              <span>{copy.collisions}</span>
              <strong>{collisionLevel}</strong>
            </div>
          </div>

          <div className={styles.breakdownList}>
            <div className={styles.resultSectionTitle}>{copy.factorsTitle}</div>
            {breakdown.map((item) => (
              <div key={item.key} className={styles.breakdownItem}>
                <div className={styles.breakdownTop}>
                  <span>{item.label}</span>
                  <strong>{formatSigned(item.value)}</strong>
                </div>
                <div className={styles.breakdownTrack}>
                  <i
                    style={{
                      width: `${Math.min(100, (Math.abs(item.value) / 28) * 100)}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.whatIfAdvice}>
            <ShieldAlert size={18} />
            <span>
              {t(adviceKey, {
                district: scenario.district,
                score: riskScore,
              })}
            </span>
          </div>

          <div className={styles.dataConfidence}>
            <div className={styles.resultSectionTitle}>{copy.dataTitle}</div>
            <span>
              {copy.basedOn}: {selectedDistrictStats.total} {copy.reports},{" "}
              {copy.weatherTraffic}
            </span>
            <strong>{copy.updated}</strong>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function Forecast() {
  const { t, tw, language } = useI18n();
  const selectedDate = useAppStore((state) => state.selectedDate);
  const fetchTrafficReports = useAppStore((state) => state.fetchTrafficReports);
  const fetchAccidents = useAppStore((state) => state.fetchAccidents);
  const trafficReports = useAppStore((state) => state.trafficReports);
  const accidents = useAppStore((state) => state.accidents);

  const [forecastData, setForecastData] = useState(null);
  const districtsGeojson = useDistrictsGeojson();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scenario, setScenario] = useState({
    district: "Almaty",
    time: "evening",
    weather: "snow",
    traffic: "high",
    event: "accident",
    visibility: "low",
    roadRepair: false,
    roadClosure: false,
    measures: [],
  });
  const scenarioCopy = getScenarioCopy(language);

  const fetchForecast = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const refreshSeed = Date.now() + Math.floor(Math.random() * 1000000);
        const styleHint =
          STYLE_HINTS[Math.floor(Math.random() * STYLE_HINTS.length)];

        const forecast = await getForecast({
          selectedDate,
          refreshSeed,
          styleHint,
          language,
        });

        setForecastData(forecast);
      } catch (error) {
        reportError("Error fetching AI forecast:", error);
        setForecastData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [language, selectedDate],
  );

  useEffect(() => {
    fetchTrafficReports();
    fetchAccidents();
    fetchForecast(false);
  }, [selectedDate, fetchTrafficReports, fetchAccidents, fetchForecast]);

  const combinedForecastItems = useMemo(() => {
    const reports = (trafficReports || []).map((item) => ({
      ...item,
      source: "report",
      severity_normalized: normalizeSeverity(item.severity, item.category),
      type_normalized: normalizeType(item.type || item.category),
      weather_normalized: normalizeWeather(item.weather),
      forecastDistrict: resolveDisplayDistrict(item, districtsGeojson),
    }));

    const realAccidents = (accidents || []).map((item) => ({
      ...item,
      source: "accident",
      severity_normalized: normalizeSeverity(item.severity),
      type_normalized: normalizeType(item.type),
      weather_normalized: normalizeWeather(item.weather),
      forecastDistrict: resolveDisplayDistrict(item, districtsGeojson),
    }));

    return [...reports, ...realAccidents].filter(
      (item) => item.forecastDistrict && item.forecastDistrict !== "Unknown",
    );
  }, [trafficReports, accidents, districtsGeojson]);

  const districtStats = useMemo(() => {
    const stats = {};

    combinedForecastItems.forEach((item) => {
      const district = item.forecastDistrict;
      if (!district || district === "Unknown") return;

      if (!stats[district]) {
        stats[district] = {
          total: 0,
          high: 0,
          medium: 0,
          jams: 0,
          collisions: 0,
          weather: {},
        };
      }

      stats[district].total += 1;

      if (item.severity_normalized === "high") stats[district].high += 1;
      if (item.severity_normalized === "medium") stats[district].medium += 1;
      if (item.type_normalized === "traffic jam") stats[district].jams += 1;
      if (item.type_normalized === "collision") stats[district].collisions += 1;

      const weatherKey = item.weather_normalized || "unknown";
      stats[district].weather[weatherKey] =
        (stats[district].weather[weatherKey] || 0) + 1;
    });

    return stats;
  }, [combinedForecastItems]);

  const rankedDistricts = useMemo(() => {
    return Object.entries(districtStats)
      .map(([district, stats]) => {
        const score =
          stats.total +
          stats.high * 3 +
          stats.medium * 2 +
          stats.jams * 2 +
          stats.collisions;

        const dominantWeather =
          Object.entries(stats.weather).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "mixed";

        return {
          name: district,
          score,
          total: stats.total,
          high: stats.high,
          medium: stats.medium,
          jams: stats.jams,
          collisions: stats.collisions,
          dominantWeather,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [districtStats]);

  const districtOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...rankedDistricts.map((district) => district.name),
        ...DEFAULT_DISTRICTS,
      ]),
    ).filter(Boolean);
  }, [rankedDistricts]);

  const fallbackDangerZones = useMemo(() => {
    return rankedDistricts.slice(0, 3).map((district) => ({
      name: district.name,
      tag:
        district.high > 0
          ? t("forecast.highWatchZone")
          : district.jams > 0
            ? t("forecast.trafficPressure")
            : t("forecast.watchZone"),
      desc:
        scenarioCopy.zoneDescription({
          total: district.total,
          jams: district.jams,
          high: district.high,
          weather: tw(district.dominantWeather),
        }),
    }));
  }, [rankedDistricts, scenarioCopy, t, tw]);

  const effectiveDangerZones =
    forecastData?.danger_zones?.length > 0
      ? forecastData.danger_zones
      : fallbackDangerZones;

  const fallbackRiskLevel = useMemo(() => {
    const total = combinedForecastItems.length;
    const high = combinedForecastItems.filter(
      (item) => item.severity_normalized === "high",
    ).length;
    const jams = combinedForecastItems.filter(
      (item) => item.type_normalized === "traffic jam",
    ).length;

    if (high >= 3 || total >= 12) return "HIGH";
    if (high >= 1 || jams >= 2 || total >= 5) return "MEDIUM";
    return "LOW";
  }, [combinedForecastItems]);

  const effectiveRiskLevel = forecastData?.risk_level || fallbackRiskLevel;

  const busiestDistrict = rankedDistricts[0]?.name || "Unknown";

  const fallbackInsight = useMemo(() => {
    if (!combinedForecastItems.length) {
      return t("forecast.noDangerZones");
    }

    const totalReports = trafficReports.length;
    const activeJams = trafficReports.filter((item) => {
      const type = normalizeType(item.type || item.category);
      return type === "traffic jam";
    }).length;

    return scenarioCopy.fallbackInsight({
      district: busiestDistrict,
      totalReports,
      activeJams,
    });
  }, [combinedForecastItems, busiestDistrict, scenarioCopy, trafficReports, t]);

  const fallbackReasoning = useMemo(() => {
    if (!rankedDistricts.length) {
      return scenarioCopy.noDistrictAnalysis;
    }

    const top = rankedDistricts[0];
    return scenarioCopy.fallbackReasoning({
      district: top.name,
      total: top.total,
      jams: top.jams,
      collisions: top.collisions,
      high: top.high,
      weather: tw(top.dominantWeather),
    });
  }, [rankedDistricts, scenarioCopy, tw]);

  const fallbackRecommendation = useMemo(() => {
    if (!rankedDistricts.length) {
      return scenarioCopy.fallbackRecommendation;
    }

    const top = rankedDistricts[0];
    return scenarioCopy.districtRecommendation({ district: top.name });
  }, [rankedDistricts, scenarioCopy]);

  const effectiveInsight = forecastData?.insight?.includes("Citywide")
    ? fallbackInsight
    : forecastData?.insight || fallbackInsight;

  const effectiveReasoning = forecastData?.reasoning?.includes("Citywide")
    ? fallbackReasoning
    : forecastData?.reasoning || fallbackReasoning;

  const effectiveRecommendation =
    forecastData?.recommendation || fallbackRecommendation;

  const riskColor =
    effectiveRiskLevel === "HIGH"
      ? "#ef4444"
      : effectiveRiskLevel === "MEDIUM"
        ? "#f59e0b"
        : "#22c55e";

  return (
    <div>
      <Topbar title="Forecast" />

      <div className={styles.forecastStyle9}>
        <div className={styles.forecastStyle10}>
          <div className={styles.forecastStyle11}>
            <div className={styles.forecastStyle12}>
              <Sparkles size={20} color="white" />
            </div>

            <div>
              <div className={styles.forecastStyle13}>
                {forecastData?.summary_title ||
                  t("forecast.aiSafetyIntelligence")}
              </div>
              <div className={styles.forecastStyle14}>
                {forecastData?.summary_subtitle ||
                  t("forecast.realtimePredictive")}
              </div>
              <div className={styles.forecastStyle15}>
                {t("forecast.analysisDate")}:{" "}
                {selectedDate ? formatDate(selectedDate) : t("common.today")}
              </div>
            </div>
          </div>

          <button
            onClick={() => fetchForecast(true)}
            disabled={refreshing}
            className={styles.forecastStyle16}
          >
            <RefreshCw size={16} />
            {refreshing
              ? t("forecast.refreshing")
              : t("forecast.refreshForecast")}
          </button>
        </div>

        {loading ? (
          <div className={styles.forecastStyle17}>
            {t("forecast.loadingForecast")}
          </div>
        ) : (
          <>
            <div className={styles.forecastStyle18}>{effectiveInsight}</div>

            <div
              className={["forecast-box-grid", styles.forecastStyle19]
                .filter(Boolean)
                .join(" ")}
            >
              <ForecastBox
                title={t("forecast.morning")}
                risk={forecastData?.morning?.risk || "LOW"}
                text={forecastData?.morning?.text || t("common.noData")}
                t={t}
              />

              <ForecastBox
                title={t("forecast.afternoon")}
                risk={forecastData?.afternoon?.risk || "LOW"}
                text={forecastData?.afternoon?.text || t("common.noData")}
                t={t}
              />

              <ForecastBox
                title={t("forecast.evening")}
                risk={forecastData?.evening?.risk || "LOW"}
                text={forecastData?.evening?.text || t("common.noData")}
                t={t}
              />
            </div>

            <div
              className={["forecast-box-grid", styles.forecastStyle20]
                .filter(Boolean)
                .join(" ")}
            >
              <ForecastBox
                title={t("forecast.night")}
                risk={forecastData?.night?.risk || "LOW"}
                text={forecastData?.night?.text || t("common.noData")}
                t={t}
              />
            </div>
          </>
        )}
      </div>

      <RoadScenarioPlanner
        districtOptions={districtOptions}
        districtStats={districtStats}
        districtsGeojson={districtsGeojson}
        scenario={scenario}
        setScenario={setScenario}
        language={language}
        t={t}
      />

      <div
        className={["forecast-content-grid", styles.forecastStyle21]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.forecastStyle22}>
          <SectionCard>
            <div className={styles.forecastStyle23}>
              <div className={styles.forecastStyle24}>
                <TriangleAlert size={18} color="#f59e0b" />
                <span>{t("forecast.predictedDangerZones")}</span>
              </div>

              <div className={styles.forecastStyle25}>
                {t("forecast.next12Hours")}
              </div>
            </div>

            {effectiveDangerZones?.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    effectiveDangerZones.length === 1 ? "1fr" : "1fr 1fr",
                  gap: "14px",
                }}
              >
                {effectiveDangerZones.map((zone, index) => (
                  <DangerZoneCard
                    key={`${zone.name}-${index}`}
                    zone={zone}
                    index={index}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.forecastStyle26}>
                {t("forecast.noDangerZones")}
              </div>
            )}
          </SectionCard>
        </div>

        <div className={styles.forecastStyle27}>
          <SectionCard>
            <div className={styles.forecastStyle28}>
              <Sparkles size={18} color="#3b82f6" />
              <span>{t("forecast.aiAnalysis")}</span>
            </div>

            <div className={styles.forecastStyle29}>
              <div className={styles.forecastStyle30}>
                {t("forecast.riskLevel")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: riskColor,
                  fontWeight: 800,
                  fontSize: "24px",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "999px",
                    background: riskColor,
                  }}
                />

                {effectiveRiskLevel || "UNKNOWN"}
              </div>
            </div>

            <div className={styles.forecastStyle31}>
              {t("forecast.reasoning")}
            </div>
            <div className={styles.forecastStyle32}>{effectiveReasoning}</div>
          </SectionCard>

          <div className={styles.forecastStyle33}>
            <div className={styles.forecastStyle34}>
              <ShieldAlert size={18} color="#60a5fa" />
              {t("forecast.safetyRecommendation")}
            </div>
            <div className={styles.forecastStyle35}>
              {effectiveRecommendation}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
