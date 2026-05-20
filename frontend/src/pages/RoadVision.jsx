import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  useMap,
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
      geminiFrames:
        "Gemini Vision built the chronology from visible video frames.",
      preparedFrames:
        "A prepared frame-by-frame report was loaded for this exact video.",
      geminiManual:
        "Gemini responded, but the chronology requires manual video review.",
      fallbackReport:
        "The video was accepted, but Gemini Vision is unavailable or did not respond. A fallback template report is shown and should be checked frame by frame.",
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
      quotaTitle: "Gemini API quota exceeded",
      fallbackTitle: "Fallback template analysis",
      framesText:
        "Chronology and participants were extracted from visual video analysis.",
      fallbackText:
        "Gemini Vision did not confirm frame-based analysis, so the operator should review the result against the source video.",
    },
    panel: {
      videoAnalysis: "Video analysis",
      newAnalysis: "new",
      uploadVideo: "Upload accident video",
      uploadHint: "MP4, MOV, WEBM, or dashcam recording",
      locationMark: "Accident mark",
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
      geminiFrames:
        "Gemini Vision построил хронологию по видимым кадрам видео.",
      preparedFrames:
        "Для этого видео загружен заранее сверенный отчет по ключевым кадрам.",
      geminiManual:
        "Gemini ответил, но хронология требует ручной сверки по видео.",
      fallbackReport:
        "Видео принято, но Gemini Vision недоступен или не дал ответ. Показан резервный шаблонный отчет: хронология и риск требуют ручной сверки по кадрам.",
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
      quotaTitle: "Лимит Gemini API исчерпан",
      fallbackTitle: "Резервный шаблонный анализ",
      framesText:
        "Хронология и участники получены из визуального анализа видео.",
      fallbackText:
        "Gemini Vision не подтвердил анализ по кадрам, поэтому результат нужно сверить оператору по исходному видео.",
    },
    panel: {
      videoAnalysis: "Видео-анализ",
      newAnalysis: "new",
      uploadVideo: "Загрузить видео ДТП",
      uploadHint: "MP4, MOV, WEBM или запись с видеорегистратора",
      locationMark: "Отметка ДТП",
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
      geminiFrames:
        "Gemini Vision хронологияны видеода көрінетін кадрлар бойынша құрды.",
      preparedFrames:
        "Осы видео үшін алдын ала тексерілген кадрлық есеп жүктелді.",
      geminiManual:
        "Gemini жауап берді, бірақ хронологияны видео бойынша қолмен тексеру керек.",
      fallbackReport:
        "Видео қабылданды, бірақ Gemini Vision қолжетімсіз немесе жауап бермеді. Резервтік шаблон есебі көрсетілді: хронология мен тәуекелді кадрлар бойынша тексеру қажет.",
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
      quotaTitle: "Gemini API лимиті бітті",
      fallbackTitle: "Резервтік шаблон талдауы",
      framesText:
        "Хронология мен қатысушылар визуалды видео талдауынан алынды.",
      fallbackText:
        "Gemini Vision кадрлық талдауды растамады, сондықтан нәтижені оператор бастапқы видео бойынша тексеруі керек.",
    },
    panel: {
      videoAnalysis: "Видео-талдау",
      newAnalysis: "new",
      uploadVideo: "ЖКО видеосын жүктеу",
      uploadHint: "MP4, MOV, WEBM немесе видеотіркеуіш жазбасы",
      locationMark: "ЖКО белгісі",
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

function FocusRoadVisionEvent({ event }) {
  const map = useMap();

  useEffect(() => {
    if (!event) return;
    map.flyTo([event.lat, event.lng], 14, { duration: 0.7 });
  }, [event, map]);

  return null;
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

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
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
  if (source === "roadvision_mvp") return "Backend CV MVP";
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
  selectedLocation = DEFAULT_ACCIDENT_LOCATION,
  onLocationChange,
  interactive = false,
  copy = ROADVISION_COPY.ru,
}) {
  const event = analysis?.map_event;
  const location = analysis?.location;
  const marker = event || selectedLocation;
  const markerTitle = analysis ? copy.mapMarkerAnalyzed : copy.mapMarker;
  const center = [marker?.lat || DEFAULT_ACCIDENT_LOCATION.lat, marker?.lng || DEFAULT_ACCIDENT_LOCATION.lng];

  const handlePick = (latlng) => {
    if (!interactive || !onLocationChange) return;
    onLocationChange(buildPickedLocation(latlng.lat, latlng.lng, copy));
  };

  return (
    <MapContainer center={center} zoom={13} className={styles.map}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusRoadVisionEvent event={marker} />
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
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_ACCIDENT_LOCATION);
  const [analysis, setAnalysis] = useState(null);
  const [plateCorrections, setPlateCorrections] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState(null);
  const [caseActionMessage, setCaseActionMessage] = useState(null);

  const currentAnalysis = useMemo(
    () => applyPlateCorrections(analysis, plateCorrections),
    [analysis, plateCorrections],
  );
  const hasAnalysis = Boolean(currentAnalysis);
  const timelineSource = currentAnalysis?.analysis_quality?.timeline_source || "";
  const isTemplateAnalysis =
    hasAnalysis && String(timelineSource).includes("scenario_template");
  const hasFrameAnalysis =
    hasAnalysis &&
    ["gemini_vision", "roadvision_prepared"].includes(currentAnalysis?.source) &&
    !isTemplateAnalysis;
  const geminiMessage = currentAnalysis?.analysis_quality?.gemini_message || "";
  const geminiStatus = currentAnalysis?.analysis_quality?.gemini_status || "";
  const analysisTitle = hasFrameAnalysis
    ? currentAnalysis?.scenario?.title || copy.videoAnalysisTitle
    : copy.detectEventTitle;

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
  }, [selectedLocation, file]);

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

      if (result.source === "roadvision_prepared") {
        setNotice({ key: "preparedFrames" });
      } else if (result.source === "gemini_vision") {
        const source = result.analysis_quality?.timeline_source;
        setNotice(
          source === "gemini_video_frames"
            ? { key: "geminiFrames" }
            : { key: "geminiManual" },
        );
      } else {
        setNotice(
          result.analysis_quality?.gemini_status === "quota_exceeded"
            ? { key: "fallbackReport" }
            : { key: "fallbackReport" },
        );
      }
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
          location: currentAnalysis.location?.name || selectedLocation.name,
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
              {hasFrameAnalysis
                ? copy.mode.framesTitle
                : geminiStatus === "quota_exceeded"
                  ? copy.mode.quotaTitle
                  : copy.mode.fallbackTitle}
            </strong>
            <span>
              {hasFrameAnalysis
                ? copy.mode.framesText
                : geminiMessage ||
                  copy.mode.fallbackText}
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
                <strong>{selectedLocation.name}</strong>
                <small>
                  {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                </small>
              </div>
            </div>

            <div className={styles.locationPickerWrap}>
              <RoadVisionMap
                selectedLocation={selectedLocation}
                onLocationChange={handleLocationChange}
                interactive
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

          {hasAnalysis && currentAnalysis.analysis_quality?.warnings?.length ? (
            <div className={styles.qualityBox}>
              <Info size={17} />
              <div>
                {currentAnalysis.analysis_quality.warnings.map((warning) => (
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
              <p>{currentAnalysis?.location?.name || selectedLocation.name}</p>
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
