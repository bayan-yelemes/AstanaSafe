import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import {
  AlertTriangle,
  Check,
  Clock3,
  Download,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
  Upload,
} from "../components/UI/icons";
import SectionCard from "../components/UI/SectionCard";
import Topbar from "../components/UI/Topbar";
import {
  analyzeRoadVisionVideo,
  buildRoadVisionFallback,
} from "../services/roadVisionService";
import { useI18n } from "../i18n";
import { reportError } from "../utils/logger";
import styles from "./RoadVision.module.css";

const ROADVISION_COPY = {
  en: {
    pipeline: {
      file: "File",
      vehicles: "Vehicles",
      plates: "Plates",
      event: "Event",
      report: "Report",
    },
    status: {
      analyzing: "Analyzing",
      clientFallback: "Local demo analysis",
      fileUploaded: "Video uploaded",
      waitingVideo: "Waiting for video",
    },
    timelineSource: {
      geminiFrames: "Gemini frame chronology",
      preparedFrames: "Prepared frame chronology",
      geminiVideo: "Gemini chronology",
      manualReview: "Manual review needed",
      fallbackTemplate: "Fallback template",
      default: "Chronology source",
    },
    pickedLocation: ({ lat, lng }) =>
      `Accident mark: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    previewAria: "RoadVision uploaded video preview",
    noVideoSelected: "No video selected",
    plateRequiresReview: "Review required",
    plate: "Plate number",
    verified: "verified",
    manualReview: "manual review",
    correctPlate: "Correct plate",
    platePlaceholder: "example 777ABC01",
    noViolationSigns: "no violation signs highlighted",
    mapMarkerAnalyzed: "Accident mark after analysis",
    mapMarker: "Accident mark",
    risk: "Risk",
    moveMapHint: "Click the map to move the point.",
    videoAnalysisTitle: "Accident video analysis",
    detectEventTitle: "AI will detect the event type from the video",
    headerKicker: "AI ROAD FORENSICS",
    headerTitle: "RoadVision AI",
    headerText:
      "CITY MONITOR module for dashcam accident review: vehicles, plate numbers, contact moment, and traffic impact.",
    notices: {
      uploadVideoFirst:
        "Upload an accident video first: without a file RoadVision will not show a demo report as real analysis.",
      pickLocationFirst:
        "Pick the accident location on the map first.",
      geminiFrames:
        "Gemini Vision built the chronology from visible video frames.",
      preparedFrames:
        "A prepared frame-by-frame report was loaded for this exact video.",
      geminiManual:
        "Gemini responded, but the chronology requires manual video review.",
      fallbackReport:
        "The video was accepted. A template report is shown and should be checked manually.",
      backendUnavailable:
        "The backend is unavailable, so local demo analysis is enabled.",
    },
    actions: {
      reportExported:
        "The report was exported to JSON. It can be attached to an incident card or checked manually.",
      draftCreated:
        "Accident card draft prepared: {risk} risk · {location}.",
      dispatcherPrepared:
        "Dispatcher summary prepared. Before sending, the operator should review the video, plate numbers, and chronology.",
    },
    metrics: {
      confidence: "AI confidence",
      risk: "Area risk",
      plates: "Plate numbers",
      delay: "Delay",
      review: "review",
      minutes: "min",
    },
    mode: {
      framesTitle: "Video analysis built from frames",
      quotaTitle: "Template analysis",
      fallbackTitle: "Template analysis",
      framesText:
        "Chronology and participants were extracted from visual video analysis.",
      fallbackText:
        "RoadVision is using the scenario template, so the operator should review the result against the source video.",
    },
    panel: {
      videoAnalysis: "Video analysis",
      newAnalysis: "new",
      uploadVideo: "Upload accident video",
      uploadHint: "MP4, MOV, WEBM, or dashcam recording",
      locationMark: "Accident mark",
      locationNotSelected: "No mark selected",
      locationNotSelectedHint: "The map stays clear until you click it.",
      locationHint: "Click the map to place or move the accident mark.",
      analyze: "Run RoadVision",
      analyzing: "Analyzing...",
      video: "Video",
      statusFrame: "Frame analysis",
      statusReview: "Review needed",
      statusWaitAnalysis: "Waiting for analysis",
      statusWaitVideo: "Waiting for video",
      participants: "Accident participants",
      participantsEmptyTitle: "Participants will appear after analysis",
      participantsEmptyText:
        "Upload a video and run RoadVision first, so demo participants are not shown as a real result.",
      timeline: "Chronology",
      timelineEmptyTitle: "Chronology is not built yet",
      timelineEmptyText:
        "The timeline will be filled only after video processing or after the fallback template report.",
      eventMap: "Event map",
      conclusion: "Preliminary conclusion",
      conclusionEmptyTitle: "Conclusion has not been formed yet",
      conclusionEmptyText:
        "RoadVision will not show probability, responsible party, or traffic impact before analysis starts.",
    },
    conclusion: {
      probableCause: "Probable cause",
      violationParticipant: "Participant with violation signs",
      trafficImpact: "Traffic impact",
      downloadReport: "Download report",
      createCard: "Create card",
      sendDispatcher: "Send to dispatcher",
    },
  },
  ru: {
    pipeline: {
      file: "Файл",
      vehicles: "Транспорт",
      plates: "Номера",
      event: "Событие",
      report: "Отчет",
    },
    status: {
      analyzing: "Анализ идет",
      clientFallback: "Локальный demo-анализ",
      fileUploaded: "Видео загружено",
      waitingVideo: "Ожидает видео",
    },
    timelineSource: {
      geminiFrames: "Хронология по кадрам Gemini",
      preparedFrames: "Заготовленная хронология по кадрам",
      geminiVideo: "Хронология Gemini",
      manualReview: "Нужна ручная сверка",
      fallbackTemplate: "Резервный шаблон",
      default: "Источник хронологии",
    },
    pickedLocation: ({ lat, lng }) =>
      `Отметка ДТП: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    previewAria: "Предпросмотр загруженного видео RoadVision",
    noVideoSelected: "Видео не выбрано",
    plateRequiresReview: "Требуется проверка",
    plate: "Госномер",
    verified: "проверено",
    manualReview: "ручная проверка",
    correctPlate: "Уточнить номер",
    platePlaceholder: "например 777ABC01",
    noViolationSigns: "признаки нарушения не выделены",
    mapMarkerAnalyzed: "Отметка ДТП после анализа",
    mapMarker: "Отметка ДТП",
    risk: "Риск",
    moveMapHint: "Кликните по карте, чтобы перенести точку.",
    videoAnalysisTitle: "Видеоанализ ДТП",
    detectEventTitle: "Тип события определит AI по видео",
    headerKicker: "AI ROAD FORENSICS",
    headerTitle: "RoadVision AI",
    headerText:
      "Модуль CITY MONITOR для разбора ДТП по видеорегистратору: транспорт, госномера, момент контакта и влияние на пробку.",
    notices: {
      uploadVideoFirst:
        "Сначала загрузи видео ДТП: без файла RoadVision не будет показывать демонстрационный отчет как реальный анализ.",
      pickLocationFirst:
        "Сначала поставьте отметку ДТП на карте.",
      geminiFrames:
        "Gemini Vision построил хронологию по видимым кадрам видео.",
      preparedFrames:
        "Для этого видео загружен заранее сверенный отчет по ключевым кадрам.",
      geminiManual:
        "Gemini ответил, но хронология требует ручной сверки по видео.",
      fallbackReport:
        "Видео принято. Показан шаблонный отчет: хронология и риск требуют ручной сверки.",
      backendUnavailable:
        "Backend недоступен, поэтому включен локальный demo-анализ.",
    },
    actions: {
      reportExported:
        "Отчет выгружен в JSON. Его можно приложить к карточке происшествия или проверить вручную.",
      draftCreated: "Черновик карточки ДТП подготовлен: {risk} риска · {location}.",
      dispatcherPrepared:
        "Сводка подготовлена для диспетчера. Перед отправкой оператор должен сверить видео, номера и хронологию.",
    },
    metrics: {
      confidence: "Уверенность AI",
      risk: "Риск участка",
      plates: "Госномера",
      delay: "Задержка",
      review: "проверка",
      minutes: "мин",
    },
    mode: {
      framesTitle: "Видеоанализ построен по кадрам",
      quotaTitle: "Шаблонный анализ",
      fallbackTitle: "Шаблонный анализ",
      framesText:
        "Хронология и участники получены из визуального анализа видео.",
      fallbackText:
        "RoadVision использует сценарный шаблон, поэтому результат нужно сверить оператору по исходному видео.",
    },
    panel: {
      videoAnalysis: "Видео-анализ",
      newAnalysis: "new",
      uploadVideo: "Загрузить видео ДТП",
      uploadHint: "MP4, MOV, WEBM или запись с видеорегистратора",
      locationMark: "Отметка ДТП",
      locationNotSelected: "Метка не выбрана",
      locationNotSelectedHint: "Карта останется без метки, пока вы не кликнете по ней.",
      locationHint: "Кликните по карте, чтобы поставить или перенести отметку ДТП.",
      analyze: "Запустить RoadVision",
      analyzing: "Анализ идет...",
      video: "Видео",
      statusFrame: "Анализ по кадрам",
      statusReview: "Нужна сверка",
      statusWaitAnalysis: "Ожидает анализа",
      statusWaitVideo: "Ожидает видео",
      participants: "Участники ДТП",
      participantsEmptyTitle: "Участники появятся после анализа",
      participantsEmptyText:
        "Сначала загрузите видео и запустите RoadVision, чтобы не показывать демо-участников как реальный результат.",
      timeline: "Хронология",
      timelineEmptyTitle: "Хронология еще не построена",
      timelineEmptyText:
        "Временная шкала будет заполнена только после обработки видео или после резервного шаблонного отчета.",
      eventMap: "Карта события",
      conclusion: "Предварительное заключение",
      conclusionEmptyTitle: "Заключение пока не сформировано",
      conclusionEmptyText:
        "RoadVision не будет показывать вероятность, виновника или пробку до запуска анализа.",
    },
    conclusion: {
      probableCause: "Вероятная причина",
      violationParticipant: "Участник с признаками нарушения",
      trafficImpact: "Влияние на пробку",
      downloadReport: "Скачать отчет",
      createCard: "Создать карточку",
      sendDispatcher: "Передать диспетчеру",
    },
  },
  kz: {
    pipeline: {
      file: "Файл",
      vehicles: "Көлік",
      plates: "Нөмірлер",
      event: "Оқиға",
      report: "Есеп",
    },
    status: {
      analyzing: "Талдау жүріп жатыр",
      clientFallback: "Жергілікті demo-талдау",
      fileUploaded: "Видео жүктелді",
      waitingVideo: "Видео күтілуде",
    },
    timelineSource: {
      geminiFrames: "Gemini кадрлары бойынша хронология",
      preparedFrames: "Дайын кадрлық хронология",
      geminiVideo: "Gemini хронологиясы",
      manualReview: "Қолмен тексеру керек",
      fallbackTemplate: "Резервтік шаблон",
      default: "Хронология дереккөзі",
    },
    pickedLocation: ({ lat, lng }) =>
      `ЖКО белгісі: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    previewAria: "RoadVision жүктелген видеосын алдын ала көру",
    noVideoSelected: "Видео таңдалмаған",
    plateRequiresReview: "Тексеру қажет",
    plate: "Мемлекеттік нөмір",
    verified: "тексерілді",
    manualReview: "қолмен тексеру",
    correctPlate: "Нөмірді нақтылау",
    platePlaceholder: "мысалы 777ABC01",
    noViolationSigns: "бұзушылық белгілері бөлінбеген",
    mapMarkerAnalyzed: "Талдаудан кейінгі ЖКО белгісі",
    mapMarker: "ЖКО белгісі",
    risk: "Тәуекел",
    moveMapHint: "Нүктені жылжыту үшін картаны басыңыз.",
    videoAnalysisTitle: "ЖКО видеосын талдау",
    detectEventTitle: "Оқиға түрін AI видео арқылы анықтайды",
    headerKicker: "AI ROAD FORENSICS",
    headerTitle: "RoadVision AI",
    headerText:
      "CITY MONITOR модулі видеотіркеуіш жазбасы бойынша ЖКО-ны талдайды: көлік, нөмірлер, жанасу сәті және кептеліске әсері.",
    notices: {
      uploadVideoFirst:
        "Алдымен ЖКО видеосын жүктеңіз: файлсыз RoadVision demo есебін нақты талдау ретінде көрсетпейді.",
      pickLocationFirst:
        "Алдымен картада ЖКО белгісін қойыңыз.",
      geminiFrames:
        "Gemini Vision хронологияны видеода көрінетін кадрлар бойынша құрды.",
      preparedFrames:
        "Осы видео үшін алдын ала тексерілген кадрлық есеп жүктелді.",
      geminiManual:
        "Gemini жауап берді, бірақ хронологияны видео бойынша қолмен тексеру керек.",
      fallbackReport:
        "Видео қабылданды. Шаблон есебі көрсетілді: хронология мен тәуекелді қолмен тексеру қажет.",
      backendUnavailable:
        "Backend қолжетімсіз, сондықтан жергілікті demo-талдау қосылды.",
    },
    actions: {
      reportExported:
        "Есеп JSON ретінде шығарылды. Оны оқиға карточкасына қосуға немесе қолмен тексеруге болады.",
      draftCreated: "ЖКО карточкасының черновигі дайын: {risk} тәуекел · {location}.",
      dispatcherPrepared:
        "Диспетчерге арналған жиынтық дайын. Жібермес бұрын оператор видеоны, нөмірлерді және хронологияны тексеруі керек.",
    },
    metrics: {
      confidence: "AI сенімділігі",
      risk: "Учаске тәуекелі",
      plates: "Мемнөмірлер",
      delay: "Кідіріс",
      review: "тексеру",
      minutes: "мин",
    },
    mode: {
      framesTitle: "Видео талдауы кадрлар бойынша құрылды",
      quotaTitle: "Шаблон талдауы",
      fallbackTitle: "Шаблон талдауы",
      framesText:
        "Хронология мен қатысушылар визуалды видео талдауынан алынды.",
      fallbackText:
        "RoadVision сценарий шаблонын қолданады, сондықтан нәтижені оператор бастапқы видео бойынша тексеруі керек.",
    },
    panel: {
      videoAnalysis: "Видео-талдау",
      newAnalysis: "new",
      uploadVideo: "ЖКО видеосын жүктеу",
      uploadHint: "MP4, MOV, WEBM немесе видеотіркеуіш жазбасы",
      locationMark: "ЖКО белгісі",
      locationNotSelected: "Белгі таңдалмады",
      locationNotSelectedHint: "Карта оны басқанға дейін белгісіз қалады.",
      locationHint: "ЖКО белгісін қою немесе жылжыту үшін картаны басыңыз.",
      analyze: "RoadVision іске қосу",
      analyzing: "Талдау жүріп жатыр...",
      video: "Видео",
      statusFrame: "Кадр бойынша талдау",
      statusReview: "Тексеру керек",
      statusWaitAnalysis: "Талдау күтілуде",
      statusWaitVideo: "Видео күтілуде",
      participants: "ЖКО қатысушылары",
      participantsEmptyTitle: "Қатысушылар талдаудан кейін пайда болады",
      participantsEmptyText:
        "Demo қатысушылар нақты нәтиже ретінде көрсетілмеуі үшін алдымен видео жүктеп, RoadVision іске қосыңыз.",
      timeline: "Хронология",
      timelineEmptyTitle: "Хронология әлі құрылмады",
      timelineEmptyText:
        "Уақыт шкаласы тек видео өңделгеннен кейін немесе резервтік шаблон есебінен кейін толтырылады.",
      eventMap: "Оқиға картасы",
      conclusion: "Алдын ала қорытынды",
      conclusionEmptyTitle: "Қорытынды әлі қалыптасқан жоқ",
      conclusionEmptyText:
        "RoadVision талдау басталғанға дейін ықтималдықты, қатысушыны немесе кептелісті көрсетпейді.",
    },
    conclusion: {
      probableCause: "Ықтимал себеп",
      violationParticipant: "Бұзушылық белгілері бар қатысушы",
      trafficImpact: "Кептеліске әсері",
      downloadReport: "Есепті жүктеу",
      createCard: "Карточка жасау",
      sendDispatcher: "Диспетчерге жіберу",
    },
  },
};

const locationOptions = [
  {
    id: "syganak",
    name: "Кабанбай батыра / Сыганак",
    lat: 51.1239,
    lng: 71.4302,
  },
  {
    id: "turan",
    name: "Туран / Достык",
    lat: 51.1321,
    lng: 71.4184,
  },
  {
    id: "mangilik",
    name: "Мангилик Ел / Улы Дала",
    lat: 51.0906,
    lng: 71.4204,
  },
  {
    id: "saryarka",
    name: "Сарыарка / Богенбай батыра",
    lat: 51.1747,
    lng: 71.4085,
  },
];

const DEFAULT_ACCIDENT_LOCATION = locationOptions[0];
const DEFAULT_ROADVISION_SCENARIO = "unknown";
const MIN_ANALYSIS_DURATION_MS = 3200;

const pipelineStepKeys = ["file", "vehicles", "plates", "event", "report"];

function getRoadVisionCopy(language) {
  return ROADVISION_COPY[language] || ROADVISION_COPY.ru;
}

function formatCopyTemplate(template, params = {}) {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function getNoticeText(notice, copy) {
  if (!notice) return "";
  if (notice.text) return notice.text;
  return copy.notices[notice.key] || "";
}

function getActionMessageText(message, copy) {
  if (!message) return "";
  return formatCopyTemplate(copy.actions[message.key] || "", message.params);
}

function PickAccidentLocation({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });

  return null;
}

function buildPickedLocation(lat, lng, copy) {
  return {
    id: "picked",
    name: copy.pickedLocation({ lat, lng }),
    lat,
    lng,
  };
}

function roundCoordinate(value) {
  return Number(Number(value).toFixed(6));
}

function normalizeMapLocation(location) {
  if (!location) return null;

  const lat = Number(location.lat);
  const lng = Number(location.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    ...location,
    lat: roundCoordinate(lat),
    lng: roundCoordinate(lng),
  };
}

function shiftImpactZone(impactZone, fromLat, fromLng, toLat, toLng) {
  if (!Array.isArray(impactZone)) return impactZone;

  const latDelta = toLat - fromLat;
  const lngDelta = toLng - fromLng;

  return impactZone.map((point) => ({
    ...point,
    lat: roundCoordinate(Number(point.lat) + latDelta),
    lng: roundCoordinate(Number(point.lng) + lngDelta),
  }));
}

function syncMapEventToLocation(event, location) {
  const pickedLocation = normalizeMapLocation(location);
  if (!event || !pickedLocation) return event;

  const eventLat = Number(event.lat);
  const eventLng = Number(event.lng);
  const hasEventPoint = Number.isFinite(eventLat) && Number.isFinite(eventLng);

  return {
    ...event,
    lat: pickedLocation.lat,
    lng: pickedLocation.lng,
    impact_zone: hasEventPoint
      ? shiftImpactZone(
          event.impact_zone,
          eventLat,
          eventLng,
          pickedLocation.lat,
          pickedLocation.lng,
        )
      : event.impact_zone,
  };
}

function syncAnalysisToSelectedLocation(analysis, location) {
  const pickedLocation = normalizeMapLocation(location);
  if (!analysis || !pickedLocation) return analysis;

  return {
    ...analysis,
    location: {
      ...(analysis.location || {}),
      name: pickedLocation.name,
      lat: pickedLocation.lat,
      lng: pickedLocation.lng,
    },
    map_event: syncMapEventToLocation(analysis.map_event, pickedLocation),
  };
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

const ROADVISION_EN_TEXT = new Map([
  ["Требуется проверка", "Review required"],
  ["Не назначен", "Not assigned"],
  ["Vehicle A (регистратор)", "Vehicle A (dashcam)"],
  ["Vehicle B (белый седан впереди)", "Vehicle B (white sedan ahead)"],
  ["автомобиль с видеорегистратором", "dashcam vehicle"],
  ["попутный маневрирующий автомобиль", "same-direction maneuvering vehicle"],
  ["основной поток", "main traffic flow"],
  ["маневрирующий участник", "maneuvering participant"],
  ["ДТП при резком перестроении белого седана направо перед регистратором", "Crash during a sharp right merge by the white sedan in front of the dashcam vehicle"],
  ["движется прямо по правой полосе, когда белый седан с левой полосы смещается направо перед капотом", "moves straight in the right lane while the white sedan from the left lane moves right in front of the hood"],
  ["плавное сближение, затем резкое торможение из-за перестроения белого седана справа перед регистратором", "gradual closing distance, then hard braking as the white sedan merges right in front of the dashcam vehicle"],
  ["движется с левой полосы и резко перестраивается/поворачивает направо перед Vehicle A", "moves from the left lane and sharply merges/turns right in front of Vehicle A"],
  ["резкое боковое смещение вправо без безопасного интервала перед контактом", "sharp lateral move to the right without a safe gap before contact"],
  ["признаки опасного резкого перестроения/поворота направо перед автомобилем с регистратором", "signs of a dangerous sharp lane change/right turn in front of the dashcam vehicle"],
  ["Начало сближения", "Closing distance begins"],
  ["Vehicle A движется за белым седаном Vehicle B; расстояние между ними постепенно сокращается.", "Vehicle A follows the white sedan Vehicle B; the distance between them gradually decreases."],
  ["белый седан находится непосредственно перед капотом регистратора", "the white sedan is directly in front of the dashcam hood"],
  ["Белый седан готовится к смещению", "White sedan prepares to move"],
  ["Vehicle B находится перед регистратором левее траектории Vehicle A и начинает менять положение относительно полосы.", "Vehicle B is ahead of the dashcam vehicle, left of Vehicle A's path, and starts changing its lane position."],
  ["белый седан впереди расположен левее траектории регистратора", "the white sedan ahead is positioned left of the dashcam vehicle's path"],
  ["Резкий поворот направо", "Sharp right turn"],
  ["Когда Vehicle A подъезжает вперед, белый седан Vehicle B резко смещается с левой полосы направо и перекрывает путь регистратору.", "As Vehicle A moves forward, the white sedan Vehicle B sharply moves from the left lane to the right and blocks the dashcam vehicle's path."],
  ["Vehicle B оказывается под углом перед капотом и входит в правую траекторию Vehicle A", "Vehicle B appears angled in front of the hood and enters Vehicle A's right-side path"],
  ["Момент ДТП", "Crash moment"],
  ["Vehicle B пересекает траекторию Vehicle A перед капотом, происходит контакт с автомобилем-регистратором.", "Vehicle B crosses Vehicle A's path in front of the hood, and contact occurs with the dashcam vehicle."],
  ["белый седан занимает переднюю часть кадра вплотную к капоту регистратора", "the white sedan fills the front of the frame very close to the dashcam hood"],
  ["Последствия маневра", "Aftermath of the maneuver"],
  ["После контакта Vehicle B уходит правее/вперед из зоны перед капотом, Vehicle A продолжает движение с малой скоростью.", "After contact, Vehicle B moves farther right/ahead out of the area in front of the hood, while Vehicle A continues at low speed."],
  ["белый седан смещен впереди от регистратора, впереди формируется кратковременное замедление", "the white sedan has moved ahead of the dashcam vehicle, and a short slowdown forms ahead"],
  ["Отчет подготовлен по ключевым кадрам именно для видео 1000081819.mp4.", "The report was prepared from key frames specifically for video 1000081819.mp4."],
  ["Событие описано как ДТП: белый седан с левой полосы резко уходит направо перед автомобилем с регистратором.", "The event is described as a crash: the white sedan sharply moves right from the left lane in front of the dashcam vehicle."],
  ["Госномера в ролике не читаются надежно и оставлены на ручную проверку.", "License plates are not reliably readable in the video and are left for manual review."],
  ["передняя зона автомобиля с регистратором и боковая/задняя часть белого седана", "front area of the dashcam vehicle and the side/rear area of the white sedan"],
  ["белый седан с левой полосы выполнил резкое перестроение/поворот направо перед автомобилем с видеорегистратором, перекрыл его траекторию движения и создал ДТП", "the white sedan from the left lane made a sharp lane change/right turn in front of the dashcam vehicle, blocked its path, and caused the crash"],
  ["Предварительно: белый седан, двигаясь с левой полосы, резко перестроился направо перед автомобилем с видеорегистратором, перекрыл его траекторию и спровоцировал столкновение", "Preliminarily, the white sedan moved sharply right from the left lane in front of the dashcam vehicle, blocked its path, and triggered the collision"],
  ["признаки резкого перестроения/поворота направо без безопасного интервала перед Vehicle A", "signs of a sharp lane change/right turn without a safe gap in front of Vehicle A"],
  ["00:04-00:06: белый седан находится левее траектории регистратора и начинает смещение", "00:04-00:06: the white sedan is left of the dashcam vehicle's path and starts moving over"],
  ["00:06.5-00:07: Vehicle B резко уходит направо в зону движения Vehicle A", "00:06.5-00:07: Vehicle B sharply moves right into Vehicle A's path"],
  ["00:07: белый седан находится вплотную перед капотом регистратора, фиксируется момент ДТП", "00:07: the white sedan is very close in front of the dashcam hood, and the crash moment is captured"],
  ["AI формирует предварительное аналитическое заключение. Юридическая виновность устанавливается только уполномоченным органом.", "AI forms a preliminary analytical conclusion. Legal liability is determined only by the authorized authority."],
  ["кратковременная блокировка правой полосы", "short-term right-lane blockage"],
  ["правая полоса движения", "right travel lane"],
  ["Проверить фрагмент 00:04-00:07, где белый седан с левой полосы резко уходит направо перед регистратором.", "Review the 00:04-00:07 segment where the white sedan sharply moves right from the left lane in front of the dashcam vehicle."],
  ["Отметить Vehicle B как участника с признаками нарушения при маневре и сохранить фрагмент момента ДТП.", "Mark Vehicle B as the participant with violation signs during the maneuver and save the crash-moment segment."],
  ["При необходимости уточнить госномера по исходному видео вручную.", "If needed, verify license plates manually from the source video."],
  ["Событие ДТП определяется по видео", "Accident event is detected from the video"],
  ["Боковое столкновение при левом повороте", "Side collision during a left turn"],
  ["Попутное столкновение", "Same-direction collision"],
  ["Конфликт на регулируемом перекрестке", "Signalized intersection conflict"],
  ["Блокировка полосы после инцидента", "Lane blockage after the incident"],
  ["Аномальное уплотнение потока", "Abnormal traffic density"],
  ["тип события не задан оператором и требует проверки по видеозаписи", "the event type was not selected by the operator and requires video review"],
  ["признаки нарушения не назначены до сверки видео оператором", "violation signs are not assigned until operator video review"],
  ["движение участника A требует сверки по видео", "participant A movement requires video review"],
  ["движение участника B требует сверки по видео", "participant B movement requires video review"],
  ["скорость требует оценки по кадрам", "speed requires frame-by-frame assessment"],
  ["Видео принято", "Video accepted"],
  ["Система получила запись и ожидает сверки видимых участников.", "The system received the recording and is waiting for visible participant review."],
  ["Требуется анализ кадров", "Frame analysis required"],
  ["Тип события и траектории должны быть подтверждены по видеоряду.", "The event type and trajectories must be confirmed from the video sequence."],
  ["Операторская проверка", "Operator review"],
  ["Резервный отчет не назначает конкретный сценарий ДТП.", "The fallback report does not assign a specific accident scenario."],
  ["автомобиль B начал маневр и пересек траекторию автомобиля A", "vehicle B began a maneuver and crossed vehicle A's path"],
  ["признаки непредоставления преимущества при маневре", "signs of failing to yield during the maneuver"],
  ["движение прямо по основной полосе", "moving straight in the main lane"],
  ["левый поворот через конфликтную траекторию", "left turn through a conflict path"],
  ["скорость стабильная до момента контакта", "speed remains stable until contact"],
  ["замедление и изменение направления перед контактом", "slowing and direction change before contact"],
  ["Обнаружены участники", "Participants detected"],
  ["Vehicle A движется прямо, Vehicle B приближается к зоне поворота.", "Vehicle A moves straight, while Vehicle B approaches the turn area."],
  ["Начало маневра", "Maneuver begins"],
  ["Vehicle B начинает поворот и выходит на конфликтную траекторию.", "Vehicle B starts turning and enters a conflict path."],
  ["Момент контакта", "Contact moment"],
  ["Траектории участников пересекаются в центральной зоне перекрестка.", "The participants' trajectories cross in the center of the intersection."],
  ["Последствие для потока", "Traffic-flow impact"],
  ["Фиксируется блокировка полосы и рост плотности потока.", "Lane blockage and rising traffic density are recorded."],
  ["автомобиль B сократил дистанцию и не успел затормозить", "vehicle B shortened the following distance and did not brake in time"],
  ["признаки несоблюдения дистанции", "signs of unsafe following distance"],
  ["движение вперед с последующим торможением", "moving forward followed by braking"],
  ["движение позади в той же полосе", "moving behind in the same lane"],
  ["скорость снижается перед контактом", "speed decreases before contact"],
  ["запаздывающее торможение и сокращение дистанции", "delayed braking and reduced following distance"],
  ["Поток в одной полосе", "Traffic in one lane"],
  ["Vehicle A и Vehicle B движутся в одном направлении.", "Vehicle A and Vehicle B move in the same direction."],
  ["Снижение скорости", "Speed reduction"],
  ["Vehicle A замедляется, дистанция между участниками сокращается.", "Vehicle A slows down, and the distance between participants decreases."],
  ["Попутный контакт", "Same-direction contact"],
  ["Vehicle B достигает задней части Vehicle A.", "Vehicle B reaches the rear of Vehicle A."],
  ["Очередь транспорта", "Vehicle queue"],
  ["На полосе образуется локальное замедление потока.", "A local traffic slowdown forms in the lane."],
  ["Хронология построена по выбранному сценарию и требует проверки оператором.", "The chronology was built from the selected scenario and requires operator review."],
  ["Госномер не удалось надежно извлечь в demo-режиме; требуется ручное подтверждение.", "The license plate could not be reliably extracted in demo mode; manual confirmation is required."],
  ["Госномер не удалось надежно извлечь в MVP-режиме; требуется ручное подтверждение.", "The license plate could not be reliably extracted in MVP mode; manual confirmation is required."],
  ["центральная зона перекрестка", "central area of the intersection"],
  ["пересечение траекторий перед моментом контакта", "trajectory crossing before the contact moment"],
  ["изменение скорости и направления одного из участников", "change in speed and direction of one participant"],
  ["блокировка полосы после события", "lane blockage after the event"],
  ["1 полоса", "1 lane"],
  ["полоса не подтверждена", "lane not confirmed"],
  ["Проверить исходное видео оператором перед принятием процессуального решения.", "Have an operator review the source video before making any procedural decision."],
  ["Передать фрагмент с 00:04 до 00:08 в карточку происшествия.", "Attach the 00:04 to 00:08 segment to the incident card."],
  ["Отметить участок как временную зону повышенного риска на карте CITY MONITOR.", "Mark the segment as a temporary high-risk zone on the CITY MONITOR map."],
]);

const ROADVISION_EN_REPLACEMENTS = [
  [/(\d+)\s*мин\b/g, "$1 min"],
  [/Gemini API вернул 429: исчерпан лимит для модели/g, "Gemini API returned 429: quota is exhausted for model"],
  [/Показан резервный анализ; попробуйте позже или проверьте quota\/billing в Google AI Studio\./g, "A fallback analysis is shown; try again later or check quota/billing in Google AI Studio."],
  [/Gemini API не принял ключ доступа\. Проверьте GEMINI_API_KEY в backend\/\.env\./g, "Gemini API rejected the access key. Check GEMINI_API_KEY in backend/.env."],
  [/Gemini API не нашёл модель/g, "Gemini API did not find model"],
  [/Проверьте GEMINI_MODEL в backend\/\.env\./g, "Check GEMINI_MODEL in backend/.env."],
  [/Госномер/g, "License plate"],
  [/госномер/g, "license plate"],
  [/Госномера/g, "License plates"],
  [/госномера/g, "license plates"],
  [/ДТП/g, "crash"],
  [/белый седан/g, "white sedan"],
  [/Белый седан/g, "White sedan"],
  [/автомобилем с видеорегистратором/g, "dashcam vehicle"],
  [/автомобиль с видеорегистратором/g, "dashcam vehicle"],
  [/автомобилем с регистратором/g, "dashcam vehicle"],
  [/автомобиль с регистратором/g, "dashcam vehicle"],
  [/автомобиль-регистратор/g, "dashcam vehicle"],
  [/регистратором/g, "dashcam vehicle"],
  [/регистратора/g, "dashcam vehicle"],
  [/регистратор/g, "dashcam"],
  [/ручная проверка/g, "manual review"],
  [/ручное подтверждение/g, "manual confirmation"],
  [/Требуется проверка/g, "Review required"],
  [/требуется проверка/g, "review required"],
  [/резко/g, "sharply"],
  [/направо/g, "right"],
  [/налево/g, "left"],
  [/перед капотом/g, "in front of the hood"],
  [/перед Vehicle A/g, "in front of Vehicle A"],
];

function translateRoadVisionText(value, language, copy = ROADVISION_COPY.en) {
  if (typeof value !== "string" || !value) return value;
  if ((language || "ru").toLowerCase() !== "en") return value;

  const directTranslation = ROADVISION_EN_TEXT.get(value);
  if (directTranslation) return directTranslation;

  return ROADVISION_EN_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  ).replace(/(\d+)\s*min\b/g, `$1 ${copy.metrics.minutes}`);
}

function translateRoadVisionList(values, language, copy) {
  if (!Array.isArray(values)) return values;
  return values.map((value) => translateRoadVisionText(value, language, copy));
}

function localizeRoadVisionAnalysis(analysis, language, copy) {
  if (!analysis) return analysis;

  return {
    ...analysis,
    scenario: analysis.scenario
      ? {
          ...analysis.scenario,
          title: translateRoadVisionText(analysis.scenario.title, language, copy),
        }
      : analysis.scenario,
    uncertainty_reason: translateRoadVisionText(
      analysis.uncertainty_reason,
      language,
      copy,
    ),
    analysis_quality: analysis.analysis_quality
      ? {
          ...analysis.analysis_quality,
          gemini_message: translateRoadVisionText(
            analysis.analysis_quality.gemini_message,
            language,
            copy,
          ),
          warnings: translateRoadVisionList(
            analysis.analysis_quality.warnings,
            language,
            copy,
          ),
        }
      : analysis.analysis_quality,
    participants: (analysis.participants || []).map((participant) => ({
      ...participant,
      label: translateRoadVisionText(participant.label, language, copy),
      plate: translateRoadVisionText(participant.plate, language, copy),
      movement: translateRoadVisionText(participant.movement, language, copy),
      speed_trend: translateRoadVisionText(
        participant.speed_trend,
        language,
        copy,
      ),
      role: translateRoadVisionText(participant.role, language, copy),
      violation_signs: translateRoadVisionList(
        participant.violation_signs,
        language,
        copy,
      ),
    })),
    timeline: (analysis.timeline || []).map((item) => ({
      ...item,
      title: translateRoadVisionText(item.title, language, copy),
      detail: translateRoadVisionText(item.detail, language, copy),
      visual_evidence: translateRoadVisionText(
        item.visual_evidence,
        language,
        copy,
      ),
    })),
    forensics: analysis.forensics
      ? {
          ...analysis.forensics,
          collision_point: translateRoadVisionText(
            analysis.forensics.collision_point,
            language,
            copy,
          ),
          probable_cause: translateRoadVisionText(
            analysis.forensics.probable_cause,
            language,
            copy,
          ),
          violation_summary: translateRoadVisionText(
            analysis.forensics.violation_summary,
            language,
            copy,
          ),
          evidence: translateRoadVisionList(
            analysis.forensics.evidence,
            language,
            copy,
          ),
          legal_note: translateRoadVisionText(
            analysis.forensics.legal_note,
            language,
            copy,
          ),
        }
      : analysis.forensics,
    traffic_impact: analysis.traffic_impact
      ? {
          ...analysis.traffic_impact,
          lanes_blocked: translateRoadVisionText(
            analysis.traffic_impact.lanes_blocked,
            language,
            copy,
          ),
          recovery_eta: translateRoadVisionText(
            analysis.traffic_impact.recovery_eta,
            language,
            copy,
          ),
        }
      : analysis.traffic_impact,
    map_event: analysis.map_event
      ? {
          ...analysis.map_event,
          affected_roads: translateRoadVisionList(
            analysis.map_event.affected_roads,
            language,
            copy,
          ),
        }
      : analysis.map_event,
    recommendations: translateRoadVisionList(
      analysis.recommendations,
      language,
      copy,
    ),
  };
}

function applyPlateCorrections(analysis, corrections) {
  if (!analysis) return analysis;

  return {
    ...analysis,
    participants: (analysis.participants || []).map((participant) => {
      const corrected = corrections[participant.id]?.trim();

      if (!corrected) return participant;

      return {
        ...participant,
        plate: corrected.toUpperCase(),
        plate_confidence: 100,
        plate_status: "operator_verified",
      };
    }),
  };
}

function statusLabel(source, { analyzing = false, hasFile = false } = {}, copy) {
  if (analyzing) return copy.status.analyzing;
  if (source === "gemini_vision") return "Gemini Vision";
  if (source === "roadvision_prepared") return "Prepared RoadVision";
  if (source === "roadvision_mvp") return "Template RoadVision";
  if (source === "client_fallback") return copy.status.clientFallback;
  if (hasFile) return copy.status.fileUploaded;
  if (!source) return copy.status.waitingVideo;
  return "RoadVision AI";
}

function timelineSourceLabel(source, copy) {
  if (source === "gemini_video_frames") return copy.timelineSource.geminiFrames;
  if (source === "prepared_video_frames") return copy.timelineSource.preparedFrames;
  if (source === "gemini_video") return copy.timelineSource.geminiVideo;
  if (source === "scenario_template_after_gemini")
    return copy.timelineSource.manualReview;
  if (source === "scenario_template") return copy.timelineSource.fallbackTemplate;
  return copy.timelineSource.default;
}

function MetricCard({ icon, label, value, tone = "#2563eb" }) {
  return (
    <div className={styles.metricCard}>
      <div
        className={styles.metricIcon}
        style={{ color: tone, background: `${tone}14` }}
      >
        {icon({ size: 20 })}
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ProgressPipeline({ progress, analyzing, complete, copy }) {
  return (
    <div className={styles.pipeline}>
      <div className={styles.pipelineTrack}>
        <div
          className={styles.pipelineFill}
          style={{ width: `${analyzing ? progress : complete ? 100 : 0}%` }}
        />
      </div>
      <div className={styles.pipelineSteps}>
        {pipelineStepKeys.map((step, index) => {
          const active = analyzing
            ? progress >= (index / (pipelineStepKeys.length - 1)) * 100
            : complete;

          return (
            <div
              key={step}
              className={[
                styles.pipelineStep,
                active ? styles.pipelineStepActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{index + 1}</span>
              {copy.pipeline[step]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Info, title, text }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        {Icon({ size: 22 })}
      </div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function VisionPreview({ videoUrl, fileName, copy }) {
  return (
    <div
      className={[
        styles.previewShell,
        videoUrl ? "" : styles.previewShellEmpty,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          className={styles.video}
          aria-label={copy.previewAria}
        />
      ) : (
        <div className={styles.videoPlaceholder}>
          <div className={styles.videoPlaceholderIcon}>
            <Upload size={28} />
          </div>
          <strong>{fileName || copy.noVideoSelected}</strong>
          <span>MP4, MOV, WEBM</span>
        </div>
      )}
    </div>
  );
}

function ParticipantCard({
  participant,
  correction = "",
  onCorrectionChange,
  copy,
}) {
  const hasViolation = participant.violation_signs?.length > 0;
  const needsPlateReview =
    participant.plate_status === "manual_review" ||
    !participant.plate ||
    participant.plate === "Требуется проверка" ||
    participant.plate === copy.plateRequiresReview;
  const verified = participant.plate_status === "operator_verified";

  return (
    <article className={styles.participantCard}>
      <div className={styles.participantTop}>
        <div
          className={styles.participantBadge}
          style={{
            color: participant.color,
            background: `${participant.color}14`,
          }}
        >
          {participant.id}
        </div>
        <div>
          <h3>{participant.label}</h3>
          <p>{participant.role}</p>
        </div>
      </div>

      <div className={styles.plate}>
        <span>{copy.plate}</span>
        <strong>{participant.plate}</strong>
        <small>
          {verified
            ? copy.verified
            : needsPlateReview
              ? copy.manualReview
              : `${formatPercent(participant.plate_confidence)} OCR`}
        </small>
      </div>

      <label className={styles.plateCorrection}>
        <span>{copy.correctPlate}</span>
        <input
          value={correction}
          onChange={(event) => onCorrectionChange(participant.id, event.target.value)}
          placeholder={copy.platePlaceholder}
        />
      </label>

      <div className={styles.participantFacts}>
        <span>{participant.movement}</span>
        <span>{participant.speed_trend}</span>
      </div>

      <div
        className={[
          styles.violationChip,
          hasViolation ? styles.violationChipHot : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {hasViolation
          ? participant.violation_signs[0]
          : copy.noViolationSigns}
      </div>
    </article>
  );
}

function Timeline({ items }) {
  return (
    <div className={styles.timeline}>
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className={styles.timelineRow}>
          <div className={styles.timelineTime}>{item.time}</div>
          <div
            className={[
              styles.timelineDot,
              styles[`timelineDot_${item.level}`] || "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <div>
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
            {item.visual_evidence ? (
              <small className={styles.timelineEvidence}>
                {item.visual_evidence}
              </small>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoadVisionMap({
  analysis,
  selectedLocation = null,
  onLocationChange,
  interactive = false,
  mapKey = 0,
  copy = ROADVISION_COPY.ru,
}) {
  const event = syncMapEventToLocation(analysis?.map_event, selectedLocation);
  const location = normalizeMapLocation(selectedLocation) || analysis?.location;
  const marker = event || selectedLocation;
  const markerTitle = analysis ? copy.mapMarkerAnalyzed : copy.mapMarker;
  const center = [marker?.lat || DEFAULT_ACCIDENT_LOCATION.lat, marker?.lng || DEFAULT_ACCIDENT_LOCATION.lng];

  const handlePick = (latlng) => {
    if (!interactive || !onLocationChange) return;
    onLocationChange(buildPickedLocation(latlng.lat, latlng.lng, copy));
  };

  return (
    <MapContainer key={mapKey} center={center} zoom={13} className={styles.map}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {interactive ? <PickAccidentLocation onPick={handlePick} /> : null}

      {event?.impact_zone?.length ? (
        <Polygon
          positions={event.impact_zone.map((point) => [point.lat, point.lng])}
          pathOptions={{
            color: "#dc2626",
            fillColor: "#dc2626",
            fillOpacity: 0.09,
            weight: 2,
            dashArray: "8 8",
          }}
        />
      ) : null}

      {event ? (
        <>
          <Circle
            center={[event.lat, event.lng]}
            radius={analysis.traffic_impact?.affected_radius_m || 620}
            pathOptions={{
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.06,
              weight: 1,
            }}
          />
          <CircleMarker
            center={[event.lat, event.lng]}
            radius={11}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#dc2626",
              fillOpacity: 1,
              weight: 4,
            }}
          >
            <Popup>
              <div className={styles.mapPopup}>
                <strong>{markerTitle}</strong>
                <span>{location?.name}</span>
                <span>
                  {copy.risk}: {formatPercent(analysis.risk_score)}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        </>
      ) : null}
      {!event && marker ? (
        <CircleMarker
          center={[marker.lat, marker.lng]}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#dc2626",
            fillOpacity: 1,
            weight: 4,
          }}
        >
          <Popup>
            <div className={styles.mapPopup}>
              <strong>{markerTitle}</strong>
              <span>{marker.name}</span>
              <span>{copy.moveMapHint}</span>
            </div>
          </Popup>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}

export default function RoadVision() {
  const { language } = useI18n();
  const copy = getRoadVisionCopy(language);
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [plateCorrections, setPlateCorrections] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState(null);
  const [caseActionMessage, setCaseActionMessage] = useState(null);
  const [mapResetKey, setMapResetKey] = useState(0);

  const currentAnalysis = useMemo(() => {
    const correctedAnalysis = applyPlateCorrections(analysis, plateCorrections);
    const localizedAnalysis = localizeRoadVisionAnalysis(
      correctedAnalysis,
      language,
      copy,
    );
    return syncAnalysisToSelectedLocation(localizedAnalysis, selectedLocation);
  }, [analysis, plateCorrections, language, copy, selectedLocation]);
  const hasAnalysis = Boolean(currentAnalysis);
  const timelineSource = currentAnalysis?.analysis_quality?.timeline_source || "";
  const isTemplateAnalysis =
    hasAnalysis && String(timelineSource).includes("scenario_template");
  const hasFrameAnalysis =
    hasAnalysis &&
    ["gemini_vision", "roadvision_prepared"].includes(currentAnalysis?.source) &&
    !isTemplateAnalysis;
  const analysisTitle = hasFrameAnalysis
    ? currentAnalysis?.scenario?.title || copy.videoAnalysisTitle
    : copy.detectEventTitle;

  useEffect(() => {
    const resetMapState = () => {
      setSelectedLocation(null);
      setAnalysis(null);
      setNotice(null);
      setPlateCorrections({});
      setCaseActionMessage(null);
      setProgress(0);
      setMapResetKey((value) => value + 1);
    };

    const handlePageShow = (event) => {
      if (event.persisted) resetMapState();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (!file) {
      setVideoUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setAnalysis(null);
    setNotice(null);
    setPlateCorrections({});
    setCaseActionMessage(null);
    setProgress(0);
  }, [file]);

  const handlePlateCorrection = (participantId, value) => {
    setPlateCorrections((current) => ({
      ...current,
      [participantId]: value,
    }));
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
  };

  const handleLocationChange = (location) => {
    setSelectedLocation(location);
    setNotice(null);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setNotice({ key: "uploadVideoFirst" });
      setProgress(0);
      return;
    }

    if (!selectedLocation) {
      setNotice({ key: "pickLocationFirst" });
      setProgress(0);
      return;
    }

    setAnalyzing(true);
    setNotice(null);
    setCaseActionMessage(null);
    setProgress(12);

    const timer = window.setInterval(() => {
      setProgress((value) => Math.min(88, value + 11));
    }, 260);
    const analysisStartedAt = window.performance.now();

    const waitForMinimumAnalysisTime = async () => {
      const elapsed = window.performance.now() - analysisStartedAt;
      const remaining = MIN_ANALYSIS_DURATION_MS - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
    };

    try {
      const result = await analyzeRoadVisionVideo({
        file,
        scenario: DEFAULT_ROADVISION_SCENARIO,
        location: selectedLocation,
        language,
      });
      await waitForMinimumAnalysisTime();
      setAnalysis(result);
    } catch (error) {
      reportError("RoadVision analysis failed:", error);
      await waitForMinimumAnalysisTime();
      setAnalysis(
        buildRoadVisionFallback({
          file,
          scenario: DEFAULT_ROADVISION_SCENARIO,
          location: selectedLocation,
          language,
        }),
      );
      setNotice({ key: "backendUnavailable" });
    } finally {
      window.clearInterval(timer);
      setProgress(100);
      window.setTimeout(() => {
        setAnalyzing(false);
      }, 300);
    }
  };

  const handleExportReport = () => {
    if (!currentAnalysis) return;

    const report = {
      ...currentAnalysis,
      operator_review_required: true,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentAnalysis.analysis_id || "roadvision-report"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setCaseActionMessage({ key: "reportExported" });
  };

  const handleCreateIncidentDraft = () => {
    if (!currentAnalysis) return;

    setCaseActionMessage(
      {
        key: "draftCreated",
        params: {
          risk: formatPercent(currentAnalysis.risk_score),
          location:
            currentAnalysis.location?.name ||
            selectedLocation?.name ||
            copy.panel.locationNotSelected,
        },
      },
    );
  };

  const handleSendToDispatcher = () => {
    if (!currentAnalysis) return;

    setCaseActionMessage({ key: "dispatcherPrepared" });
  };

  const metrics = [
    {
      icon: Sparkles,
      label: copy.metrics.confidence,
      value: hasAnalysis ? formatPercent(currentAnalysis.confidence) : "—",
      tone: hasAnalysis ? "#2563eb" : "#64748b",
    },
    {
      icon: AlertTriangle,
      label: copy.metrics.risk,
      value: hasAnalysis ? formatPercent(currentAnalysis.risk_score) : "—",
      tone: hasAnalysis ? "#dc2626" : "#64748b",
    },
    {
      icon: Upload,
      label: copy.metrics.plates,
      value: hasAnalysis
        ? currentAnalysis.detected_objects?.license_plates
          ? currentAnalysis.detected_objects.license_plates
          : copy.metrics.review
        : "—",
      tone: hasAnalysis ? "#0891b2" : "#64748b",
    },
    {
      icon: Clock3,
      label: copy.metrics.delay,
      value: hasAnalysis
        ? `+${currentAnalysis.traffic_impact?.delay_minutes || 0} ${copy.metrics.minutes}`
        : "—",
      tone: hasAnalysis ? "#f97316" : "#64748b",
    },
  ];
  const qualityWarnings =
    currentAnalysis?.source === "roadvision_prepared"
      ? []
      : currentAnalysis?.analysis_quality?.warnings || [];

  return (
    <div>
      <Topbar
        title="RoadVision AI"
        showTrafficAction={false}
        showEmergencyAction={false}
      />

      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>{copy.headerKicker}</div>
          <h1>{copy.headerTitle}</h1>
          <p>{copy.headerText}</p>
        </div>

        <div className={styles.headerBadge}>
          <ShieldAlert size={19} />
          <span>
            {statusLabel(currentAnalysis?.source, {
              analyzing,
              hasFile: Boolean(file),
            }, copy)}
          </span>
        </div>
      </div>

      <div className={styles.metrics}>
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {hasAnalysis ? (
        <div
          className={[
            styles.modeBanner,
            hasFrameAnalysis ? styles.modeBannerOk : styles.modeBannerWarning,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Info size={18} />
          <div>
            <strong>
              {hasFrameAnalysis ? copy.mode.framesTitle : copy.mode.fallbackTitle}
            </strong>
            <span>
              {hasFrameAnalysis ? copy.mode.framesText : copy.mode.fallbackText}
            </span>
          </div>
        </div>
      ) : null}

      <div className={styles.mainGrid}>
        <SectionCard className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>{copy.panel.videoAnalysis}</h2>
              <p>{analysisTitle}</p>
            </div>
            <div className={styles.analysisId}>
              {currentAnalysis?.analysis_id || copy.panel.newAnalysis}
            </div>
          </div>

          <label className={styles.uploadBox}>
            <input type="file" accept="video/*" onChange={handleFileChange} />
            <div className={styles.uploadIcon}>
              <Upload size={24} />
            </div>
            <div>
              <strong>{file?.name || copy.panel.uploadVideo}</strong>
              <span>
                {file
                  ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                  : copy.panel.uploadHint}
              </span>
            </div>
          </label>

          <div className={styles.locationPanel}>
            <div className={styles.locationSummary}>
              <div className={styles.locationIcon}>
                <MapPin size={20} />
              </div>
              <div>
                <span>{copy.panel.locationMark}</span>
                <strong>
                  {selectedLocation?.name || copy.panel.locationNotSelected}
                </strong>
                <small>
                  {selectedLocation
                    ? `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`
                    : copy.panel.locationNotSelectedHint}
                </small>
              </div>
            </div>

            <div className={styles.locationPickerWrap}>
              <RoadVisionMap
                selectedLocation={selectedLocation}
                onLocationChange={handleLocationChange}
                interactive
                mapKey={[
                  "picker",
                  mapResetKey,
                  selectedLocation?.lat || "none",
                  selectedLocation?.lng || "none",
                ].join("-")}
                copy={copy}
              />
            </div>

            <p className={styles.locationHint}>
              {copy.panel.locationHint}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            className={styles.analyzeButton}
            disabled={analyzing}
          >
            <Sparkles size={18} />
            {analyzing ? copy.panel.analyzing : copy.panel.analyze}
          </button>

          <ProgressPipeline
            progress={progress}
            analyzing={analyzing}
            complete={hasAnalysis}
            copy={copy}
          />

          {notice ? (
            <div className={styles.notice}>
              <Info size={17} />
              <span>{getNoticeText(notice, copy)}</span>
            </div>
          ) : null}

          {hasAnalysis && qualityWarnings.length ? (
            <div className={styles.qualityBox}>
              <Info size={17} />
              <div>
                {qualityWarnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard className={styles.previewCard}>
          <div className={styles.panelHeader}>
            <div>
              <h2>{copy.panel.video}</h2>
              <p>{file?.name || copy.noVideoSelected}</p>
            </div>
            <div className={styles.statusPill}>
              <Check size={15} />
              {hasFrameAnalysis
                ? copy.panel.statusFrame
                : hasAnalysis
                  ? copy.panel.statusReview
                  : file
                    ? copy.panel.statusWaitAnalysis
                    : copy.panel.statusWaitVideo}
            </div>
          </div>

          <VisionPreview
            videoUrl={videoUrl}
            fileName={file?.name}
            copy={copy}
          />
        </SectionCard>
      </div>

      <div className={styles.analysisGrid}>
        <SectionCard>
          <div className={styles.sideHeader}>
            <ShieldAlert size={20} color="#dc2626" />
            <h2>{copy.panel.participants}</h2>
          </div>
          {hasAnalysis ? (
            <div className={styles.participantGrid}>
              {currentAnalysis.participants?.map((participant) => (
                <ParticipantCard
                  key={participant.id}
                  participant={participant}
                  correction={plateCorrections[participant.id] || ""}
                  onCorrectionChange={handlePlateCorrection}
                  copy={copy}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title={copy.panel.participantsEmptyTitle}
              text={copy.panel.participantsEmptyText}
            />
          )}
        </SectionCard>

        <SectionCard>
          <div className={styles.sideHeader}>
            <Clock3 size={20} color="#f97316" />
            <h2>{copy.panel.timeline}</h2>
            {hasAnalysis ? (
              <span className={styles.sourcePill}>
                {timelineSourceLabel(
                  currentAnalysis.analysis_quality?.timeline_source,
                  copy,
                )}
              </span>
            ) : null}
          </div>
          {hasAnalysis ? (
            <Timeline items={currentAnalysis.timeline || []} />
          ) : (
            <EmptyState
              icon={Clock3}
              title={copy.panel.timelineEmptyTitle}
              text={copy.panel.timelineEmptyText}
            />
          )}
        </SectionCard>
      </div>

      <div className={styles.bottomGrid}>
        <SectionCard className={styles.mapCard}>
          <div className={styles.panelHeader}>
            <div>
              <h2>{copy.panel.eventMap}</h2>
              <p>
                {currentAnalysis?.location?.name ||
                  selectedLocation?.name ||
                  copy.panel.locationNotSelected}
              </p>
            </div>
            {hasAnalysis ? (
              <div className={styles.statusPillHot}>
                <MapPin size={15} />
                {currentAnalysis.map_event?.severity}
              </div>
            ) : null}
          </div>
          <div className={styles.mapWrap}>
            <RoadVisionMap
              analysis={currentAnalysis}
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationChange}
              interactive
              mapKey={[
                "event",
                mapResetKey,
                currentAnalysis?.analysis_id || "draft",
                selectedLocation?.lat || "none",
                selectedLocation?.lng || "none",
              ].join("-")}
              copy={copy}
            />
          </div>
        </SectionCard>

        <SectionCard>
          <div className={styles.sideHeader}>
            <AlertTriangle size={20} color="#dc2626" />
            <h2>{copy.panel.conclusion}</h2>
          </div>

          {hasAnalysis ? (
            <>
              <div className={styles.conclusion}>
                <div>
                  <span>{copy.conclusion.probableCause}</span>
                  <strong>{currentAnalysis.forensics?.probable_cause}</strong>
                </div>
                <div>
                  <span>{copy.conclusion.violationParticipant}</span>
                  <strong>
                    {currentAnalysis.forensics?.participant_with_violation_signs}
                  </strong>
                </div>
                <div>
                  <span>{copy.conclusion.trafficImpact}</span>
                  <strong>
                    {formatPercent(currentAnalysis.traffic_impact?.jam_probability)} ·{" "}
                    {currentAnalysis.traffic_impact?.recovery_eta}
                  </strong>
                </div>
              </div>

              <div className={styles.evidenceList}>
                {currentAnalysis.forensics?.evidence?.map((item) => (
                  <div key={item}>
                    <Check size={16} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className={styles.legalNote}>
                <Info size={18} />
                <span>{currentAnalysis.forensics?.legal_note}</span>
              </div>

              <div className={styles.actionPanel}>
                <button type="button" onClick={handleExportReport}>
                  <Download size={16} />
                  {copy.conclusion.downloadReport}
                </button>
                <button type="button" onClick={handleCreateIncidentDraft}>
                  <MapPin size={16} />
                  {copy.conclusion.createCard}
                </button>
                <button type="button" onClick={handleSendToDispatcher}>
                  <ShieldAlert size={16} />
                  {copy.conclusion.sendDispatcher}
                </button>
              </div>

              {caseActionMessage ? (
                <div className={styles.actionMessage}>
                  <Check size={16} />
                  <span>{getActionMessageText(caseActionMessage, copy)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title={copy.panel.conclusionEmptyTitle}
              text={copy.panel.conclusionEmptyText}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
