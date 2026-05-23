import api from "../api/client";

const DEFAULT_LOCATION = {
  name: "Кабанбай батыра / Сыганак",
  lat: 51.1239,
  lng: 71.4302,
};

const scenarioTitles = {
  unknown: "Событие ДТП определяется по видео",
  left_turn_conflict: "Боковое столкновение при левом повороте",
  rear_end: "Попутное столкновение",
  red_light: "Конфликт на регулируемом перекрестке",
  lane_block: "Блокировка полосы после инцидента",
  traffic_jam: "Аномальное уплотнение потока",
};

const scenarioProfiles = {
  unknown: {
    cause: "Предварительно: белый седан, двигаясь с левой полосы, резко перестроился направо перед автомобилем с видеорегистратором, перекрыл его траекторию и спровоцировал столкновение",
    violationActor: "Не назначен",
    violationSummary: "признаки нарушения не назначены до сверки видео оператором",
    movementA: "движение участника A требует сверки по видео",
    movementB: "движение участника B требует сверки по видео",
    speedA: "скорость требует оценки по кадрам",
    speedB: "скорость требует оценки по кадрам",
    timeline: [
      ["00:02", "Видео принято", "Система получила запись и ожидает сверки видимых участников.", "info"],
      ["00:05", "Требуется анализ кадров", "Тип события и траектории должны быть подтверждены по видеоряду.", "warning"],
      ["00:08", "Операторская проверка", "Резервный отчет не назначает конкретный сценарий ДТП.", "warning"],
    ],
  },
  left_turn_conflict: {
    cause: "автомобиль B начал маневр и пересек траекторию автомобиля A",
    violationActor: "Vehicle B",
    violationSummary: "признаки непредоставления преимущества при маневре",
    movementA: "движение прямо по основной полосе",
    movementB: "левый поворот через конфликтную траекторию",
    speedA: "скорость стабильная до момента контакта",
    speedB: "замедление и изменение направления перед контактом",
    timeline: [
      ["00:02", "Обнаружены участники", "Vehicle A движется прямо, Vehicle B приближается к зоне поворота.", "info"],
      ["00:04", "Начало маневра", "Vehicle B начинает поворот и выходит на конфликтную траекторию.", "warning"],
      ["00:06", "Момент контакта", "Траектории участников пересекаются в центральной зоне перекрестка.", "danger"],
      ["00:11", "Последствие для потока", "Фиксируется блокировка полосы и рост плотности потока.", "warning"],
    ],
  },
  rear_end: {
    cause: "автомобиль B сократил дистанцию и не успел затормозить",
    violationActor: "Vehicle B",
    violationSummary: "признаки несоблюдения дистанции",
    movementA: "движение вперед с последующим торможением",
    movementB: "движение позади в той же полосе",
    speedA: "скорость снижается перед контактом",
    speedB: "запаздывающее торможение и сокращение дистанции",
    timeline: [
      ["00:02", "Поток в одной полосе", "Vehicle A и Vehicle B движутся в одном направлении.", "info"],
      ["00:04", "Снижение скорости", "Vehicle A замедляется, дистанция между участниками сокращается.", "warning"],
      ["00:06", "Попутный контакт", "Vehicle B достигает задней части Vehicle A.", "danger"],
      ["00:10", "Очередь транспорта", "На полосе образуется локальное замедление потока.", "warning"],
    ],
  },
  red_light: {
    cause: "один из участников продолжил движение через конфликтную фазу",
    violationActor: "Vehicle A",
    violationSummary: "признаки проезда на запрещающий сигнал",
    movementA: "продолжение движения через регулируемый перекресток",
    movementB: "движение с поперечного направления",
    speedA: "скорость не снижается перед стоп-линией",
    speedB: "ускорение после начала разрешающей фазы",
    timeline: [
      ["00:02", "Регулируемый перекресток", "Обнаружены участники на пересекающихся направлениях.", "info"],
      ["00:04", "Конфликт фаз", "Vehicle A продолжает движение, когда Vehicle B входит в перекресток.", "warning"],
      ["00:06", "Пересечение траекторий", "Участники оказываются в одной конфликтной зоне.", "danger"],
      ["00:12", "Остановка потока", "После конфликта движение на подходах замедляется.", "warning"],
    ],
  },
  lane_block: {
    cause: "транспортное средство остановилось в активной полосе движения",
    violationActor: "Vehicle B",
    violationSummary: "признаки опасной остановки на полосе",
    movementA: "объезд препятствия по соседней полосе",
    movementB: "остановка в активной полосе",
    speedA: "скорость снижается при объезде",
    speedB: "скорость падает до полной остановки",
    timeline: [
      ["00:02", "Снижение скорости", "Vehicle B резко замедляется в активной полосе.", "info"],
      ["00:05", "Остановка", "Vehicle B остается на полосе и создает препятствие.", "warning"],
      ["00:08", "Маневры объезда", "Vehicle A и соседние автомобили начинают перестроение.", "warning"],
      ["00:14", "Рост затора", "Плотность потока увеличивается за остановившимся автомобилем.", "danger"],
    ],
  },
  traffic_jam: {
    cause: "скорость потока резко снизилась и образовалась очередь автомобилей",
    violationActor: "Не назначен",
    violationSummary: "признаки ДТП не подтверждены, требуется проверка оператора",
    movementA: "движение в плотном транспортном потоке",
    movementB: "движение в соседней полосе без подтвержденного контакта",
    speedA: "плавное снижение скорости вместе с потоком",
    speedB: "скорость снижается без резкого маневра",
    timeline: [
      ["00:02", "Плотный поток", "Количество транспортных средств в кадре растет.", "info"],
      ["00:05", "Падение скорости", "Средняя скорость движения заметно снижается.", "warning"],
      ["00:09", "Очередь автомобилей", "Формируется устойчивая очередь без подтвержденного момента контакта.", "warning"],
      ["00:15", "Требуется проверка", "AI не подтверждает ДТП по видеоряду, нужна операторская валидация.", "info"],
    ],
  },
};

function stableNumber(seed, minimum, maximum) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return minimum + (hash % (maximum - minimum + 1));
}

function extractPlateCandidates(fileName = "") {
  const matches = String(fileName)
    .toUpperCase()
    .match(/[0-9]{3}[A-ZА-Я]{2,3}[0-9]{2}/g);

  return matches ? matches.slice(0, 2) : [];
}

function platePayload(candidates, index) {
  if (index < candidates.length) {
    return {
      plate: candidates[index],
      confidence: 88 + index * 2,
      status: "detected_from_filename",
    };
  }

  return {
    plate: "Требуется проверка",
    confidence: 0,
    status: "manual_review",
  };
}

function buildImpactZone(lat, lng) {
  return [
    { lat: lat + 0.0025, lng: lng - 0.0042 },
    { lat: lat + 0.0036, lng: lng + 0.0028 },
    { lat: lat - 0.0014, lng: lng + 0.0045 },
    { lat: lat - 0.0031, lng: lng - 0.0017 },
  ];
}

export function buildRoadVisionFallback({
  file,
  scenario = "left_turn_conflict",
  location = DEFAULT_LOCATION,
} = {}) {
  const seed = `${file?.name || "demo-video"}:${file?.size || 0}:${scenario}`;
  const profile = scenarioProfiles[scenario] || scenarioProfiles.left_turn_conflict;
  const confidence = stableNumber(seed, 78, 91);
  const riskScore = stableNumber(`${seed}:risk`, 72, 92);
  const delay = stableNumber(`${seed}:delay`, 18, 42);
  const plateCandidates = extractPlateCandidates(file?.name);
  const plateA = platePayload(plateCandidates, 0);
  const plateB = platePayload(plateCandidates, 1);

  return {
    analysis_id: `rv-client-${stableNumber(seed, 10000, 99999)}`,
    source: "client_fallback",
    created_at: new Date().toISOString(),
    status: "requires_human_review",
    video: {
      filename: file?.name || "demo-dashcam.mp4",
      content_type: file?.type || "video/mp4",
      size_mb: Number(((file?.size || 0) / (1024 * 1024)).toFixed(2)),
      duration_sec: null,
    },
    location: {
      name: location.name || DEFAULT_LOCATION.name,
      lat: Number(location.lat || DEFAULT_LOCATION.lat),
      lng: Number(location.lng || DEFAULT_LOCATION.lng),
      district: "Esil",
      road: (location.name || DEFAULT_LOCATION.name).split("/")[0].trim(),
    },
    scenario: {
      key: scenario,
      title: scenarioTitles[scenario] || scenarioTitles.left_turn_conflict,
      impact_type: scenario,
    },
    confidence,
    risk_score: riskScore,
    detected_objects: {
      vehicles: stableNumber(`${seed}:vehicles`, 3, 7),
      license_plates: plateCandidates.length,
      pedestrians: scenario === "red_light" ? 1 : 0,
      lanes: stableNumber(`${seed}:lanes`, 2, 4),
    },
    analysis_quality: {
      plate_recognition: plateCandidates.length
        ? "filename_hint"
        : "needs_manual_review",
      timeline_source: "scenario_template",
      warnings: [
        "Хронология построена по выбранному сценарию и требует проверки оператором.",
        ...(plateCandidates.length
          ? []
          : [
              "Госномер не удалось надежно извлечь в demo-режиме; требуется ручное подтверждение.",
            ]),
      ],
    },
    participants: [
      {
        id: "A",
        label: "Vehicle A",
        plate: plateA.plate,
        plate_confidence: plateA.confidence,
        plate_status: plateA.status,
        movement: profile.movementA,
        speed_trend: profile.speedA,
        role: "основной поток",
        color: "#2563eb",
        bbox_hint: { x: 16, y: 44, w: 24, h: 18 },
        trajectory: [
          { x: 11, y: 72 },
          { x: 24, y: 62 },
          { x: 38, y: 53 },
          { x: 51, y: 47 },
        ],
        violation_signs:
          profile.violationActor === "Vehicle A" ? [profile.violationSummary] : [],
      },
      {
        id: "B",
        label: "Vehicle B",
        plate: plateB.plate,
        plate_confidence: plateB.confidence,
        plate_status: plateB.status,
        movement: profile.movementB,
        speed_trend: profile.speedB,
        role: "маневрирующий участник",
        color: "#dc2626",
        bbox_hint: { x: 57, y: 33, w: 22, h: 17 },
        trajectory: [
          { x: 75, y: 29 },
          { x: 66, y: 37 },
          { x: 58, y: 44 },
          { x: 51, y: 47 },
        ],
        violation_signs:
          profile.violationActor === "Vehicle B" ? [profile.violationSummary] : [],
      },
    ],
    timeline: profile.timeline.map(([time, title, detail, level]) => ({
      time,
      title,
      detail,
      level,
    })),
    forensics: {
      collision_point: "центральная зона перекрестка",
      probable_cause: profile.cause,
      participant_with_violation_signs: profile.violationActor,
      violation_summary: profile.violationSummary,
      evidence: [
        "пересечение траекторий перед моментом контакта",
        "изменение скорости и направления одного из участников",
        "блокировка полосы после события",
      ],
      legal_note:
        "AI формирует предварительное аналитическое заключение. Юридическая виновность устанавливается только уполномоченным органом.",
    },
    traffic_impact: {
      jam_probability: stableNumber(`${seed}:jam`, 72, 94),
      delay_minutes: delay,
      affected_radius_m: stableNumber(`${seed}:radius`, 520, 960),
      lanes_blocked: scenario === "traffic_jam" ? "не подтверждено" : "1 полоса",
      recovery_eta: `${delay + stableNumber(`${seed}:recovery`, 12, 24)} мин`,
    },
    map_event: {
      lat: Number(location.lat || DEFAULT_LOCATION.lat),
      lng: Number(location.lng || DEFAULT_LOCATION.lng),
      severity: riskScore >= 78 ? "high" : "medium",
      impact_zone: buildImpactZone(
        Number(location.lat || DEFAULT_LOCATION.lat),
        Number(location.lng || DEFAULT_LOCATION.lng),
      ),
      affected_roads: [
        (location.name || DEFAULT_LOCATION.name).split("/")[0].trim(),
        "Сыганак",
        "Туран",
      ],
    },
    recommendations: [
      "Проверить исходное видео оператором перед принятием процессуального решения.",
      "Передать фрагмент с 00:04 до 00:08 в карточку происшествия.",
      "Отметить участок как временную зону повышенного риска на карте CITY MONITOR.",
    ],
  };
}

export async function analyzeRoadVisionVideo({
  file,
  scenario = "unknown",
  location = DEFAULT_LOCATION,
  language = "ru",
  engine = "template",
}) {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("scenario", scenario);
  formData.append("location_name", location.name || DEFAULT_LOCATION.name);
  formData.append("lat", String(location.lat || DEFAULT_LOCATION.lat));
  formData.append("lng", String(location.lng || DEFAULT_LOCATION.lng));
  formData.append("language", language);
  formData.append("engine", engine);

  const { data } = await api.post("/roadvision/analyze", formData);

  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(data.participants) ||
    !Array.isArray(data.timeline)
  ) {
    throw new Error(
      "Invalid RoadVision API response. Check the Render API service or /api rewrite.",
    );
  }

  return data;
}
