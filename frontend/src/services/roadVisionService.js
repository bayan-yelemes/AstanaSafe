import api from "../api/client";

export const DEFAULT_ROADVISION_LOCATION = {
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

const preparedVideoTemplates = [
  {
    key: "video1",
    fileNames: ["video1.mov"],
    sizeBytes: 29441810,
    durationSec: 5,
    scenario: {
      key: "prepared_video1",
      title: "Столкновение на перекрестке с белым служебным фургоном",
      impact_type: "intersection_conflict",
    },
    confidence: 94,
    riskScore: 88,
    eventConfirmed: true,
    uncertaintyReason: "",
    detectedObjects: { vehicles: 3, license_plates: 0, pedestrians: 0, lanes: 3 },
    participants: [
      {
        id: "A",
        label: "Vehicle A (регистратор)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "подъезжает к регулируемому перекрестку и движется прямо в сторону стоп-линии",
        speed_trend:
          "до контакта сохраняет ход, после удара резко теряет устойчивость",
        role: "автомобиль с видеорегистратором",
        color: "#2563eb",
        violation_signs: [],
      },
      {
        id: "B",
        label: "Vehicle B (белый фургон/служебный автомобиль)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "выезжает слева в зону движения автомобиля с регистратором",
        speed_trend:
          "пересекает траекторию Vehicle A непосредственно перед столкновением",
        role: "поперечный участник конфликта",
        color: "#dc2626",
        violation_signs: [
          "признаки выезда на конфликтную траекторию перед автомобилем с регистратором",
        ],
      },
    ],
    timeline: [
      {
        time: "00:00-00:01",
        observed_at_sec: 1,
        title: "Подъезд к перекрестку",
        detail:
          "Vehicle A подъезжает к перекрестку; впереди видны светофоры и другие автомобили.",
        visual_evidence: "в кадре видны светофоры, перекресток и поток впереди",
        level: "info",
      },
      {
        time: "00:01-00:02",
        observed_at_sec: 2,
        title: "Фургон выходит слева",
        detail:
          "Белый фургон Vehicle B появляется слева и входит в зону движения Vehicle A.",
        visual_evidence:
          "белый служебный автомобиль смещается слева поперек траектории регистратора",
        level: "warning",
      },
      {
        time: "00:02",
        observed_at_sec: 2,
        title: "Момент столкновения",
        detail:
          "Контакт приходится в переднюю часть автомобиля с регистратором.",
        visual_evidence:
          "после сближения кадр резко дергается и направление камеры уходит вверх",
        level: "danger",
      },
      {
        time: "00:03-00:05",
        observed_at_sec: 4,
        title: "Остановка после удара",
        detail:
          "Камера направлена в небо, видны светофоры и дорожные знаки; движение прекращается.",
        visual_evidence:
          "в кадре остаются небо, элементы светофора и знаки вместо дороги",
        level: "warning",
      },
    ],
    forensics: {
      collision_point:
        "передняя часть автомобиля с регистратором и боковая зона белого фургона",
      probable_cause:
        "Предварительно: белый фургон/служебный автомобиль выехал слева на перекрестке в траекторию Vehicle A, после чего произошел удар в переднюю часть автомобиля с регистратором",
      participant_with_violation_signs: "Vehicle B",
      violation_summary:
        "признаки выезда на конфликтную траекторию перед автомобилем с регистратором",
      evidence: [
        "00:01-00:02: белый фургон появляется слева в зоне движения Vehicle A",
        "00:02: фиксируется резкий удар и потеря устойчивости камеры",
        "00:03-00:05: камера направлена вверх, движение автомобиля прекращается",
      ],
    },
    trafficImpact: {
      jam_probability: 72,
      delay_minutes: 12,
      affected_radius_m: 420,
      lanes_blocked: "зона перекрестка частично заблокирована",
      recovery_eta: "18 мин",
    },
    warnings: [
      "Отчет подготовлен по шаблону для video1.mov.",
      "Зафиксировано ДТП на перекрестке: белый фургон выезжает слева и происходит удар в переднюю часть автомобиля с регистратором.",
      "После удара камера разворачивается вверх, поэтому финальная позиция участников требует ручной сверки.",
    ],
    recommendations: [
      "Проверить фрагмент 00:01-00:02, где белый фургон появляется слева перед автомобилем с регистратором.",
      "Сохранить момент 00:02 как ключевой кадр столкновения.",
      "Уточнить фазу светофора и дорожные знаки по исходному видео.",
    ],
    affectedRoads: ["перекресток", "подход к перекрестку"],
  },
  {
    key: "video2",
    fileNames: ["video2.mov"],
    sizeBytes: 71301310,
    durationSec: 7,
    scenario: {
      key: "prepared_video2",
      title: "Попутное столкновение: черный автомобиль врезается в серый автомобиль",
      impact_type: "rear_end",
    },
    confidence: 92,
    riskScore: 82,
    eventConfirmed: true,
    uncertaintyReason: "",
    detectedObjects: { vehicles: 4, license_plates: 0, pedestrians: 0, lanes: 3 },
    participants: [
      {
        id: "A",
        label: "Vehicle A (серый автомобиль впереди)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "движется впереди в правой полосе и перед ударом снижает скорость/тормозит",
        speed_trend:
          "заметное замедление перед моментом контакта, затем смещение вперед/в сторону после удара",
        role: "пострадавший автомобиль впереди",
        color: "#2563eb",
        violation_signs: [],
      },
      {
        id: "B",
        label: "Vehicle B (черный автомобиль слева)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "появляется слева, перестраивается из левой полосы в правую и на скорости сближается с серым автомобилем",
        speed_trend:
          "не успевает безопасно снизить скорость при перестроении и достигает задней части Vehicle A",
        role: "попутный автомобиль, перестраивающийся перед ударом",
        color: "#dc2626",
        violation_signs: [
          "признаки небезопасного перестроения и несоблюдения дистанции перед серым автомобилем",
        ],
      },
      {
        id: "C",
        label: "Vehicle C (регистратор)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "движется позади и фиксирует ДТП впереди без участия в столкновении",
        speed_trend: "движется вместе с потоком и наблюдает последствия впереди",
        role: "автомобиль с видеорегистратором, не участник ДТП",
        color: "#0891b2",
        violation_signs: [],
      },
    ],
    timeline: [
      {
        time: "00:00-00:03",
        observed_at_sec: 3,
        title: "Регистратор фиксирует поток впереди",
        detail:
          "Автомобиль с регистратором движется по дороге и фиксирует обстановку впереди; сам регистратор не является участником ДТП.",
        visual_evidence:
          "камера расположена позади основной зоны будущего столкновения",
        level: "info",
      },
      {
        time: "00:03-00:04",
        observed_at_sec: 4,
        title: "Серый автомобиль тормозит",
        detail:
          "Впереди в правой полосе серый автомобиль Vehicle A начинает тормозить или заметно снижает скорость.",
        visual_evidence:
          "серый автомобиль впереди уменьшает скорость относительно потока",
        level: "warning",
      },
      {
        time: "00:04-00:05",
        observed_at_sec: 5,
        title: "Черный автомобиль перестраивается направо",
        detail:
          "Черный автомобиль Vehicle B появляется слева и начинает перестраиваться из левой полосы в правую к серому автомобилю.",
        visual_evidence:
          "черный автомобиль смещается из левой полосы в правую перед регистратором",
        level: "warning",
      },
      {
        time: "00:05",
        observed_at_sec: 5,
        title: "Удар в заднюю часть",
        detail:
          "Vehicle B не успевает безопасно перестроиться и на скорости врезается в заднюю часть серого автомобиля Vehicle A.",
        visual_evidence:
          "черный автомобиль достигает задней части серого автомобиля в правой полосе",
        level: "danger",
      },
      {
        time: "00:05-00:07",
        observed_at_sec: 7,
        title: "Смещение после удара",
        detail:
          "После удара серый автомобиль смещается вперед/в сторону, черный автомобиль остается рядом с ним.",
        visual_evidence:
          "оба автомобиля остаются впереди регистратора после контакта",
        level: "warning",
      },
    ],
    forensics: {
      collision_point:
        "задняя часть серого автомобиля и передняя часть черного автомобиля",
      probable_cause:
        "Предварительно: черный автомобиль перестраивался из левой полосы в правую, не успел безопасно снизить скорость и врезался в заднюю часть серого автомобиля, который впереди снижал скорость или тормозил",
      participant_with_violation_signs: "Vehicle B",
      violation_summary:
        "признаки небезопасного перестроения и несоблюдения дистанции со стороны черного автомобиля",
      evidence: [
        "00:03-00:04: серый автомобиль впереди начинает снижать скорость",
        "00:04-00:05: черный автомобиль перестраивается из левой полосы в правую",
        "00:05: черный автомобиль достигает задней части серого автомобиля",
        "00:05-00:07: серый автомобиль смещается после удара, черный автомобиль остается рядом",
      ],
    },
    trafficImpact: {
      jam_probability: 68,
      delay_minutes: 10,
      affected_radius_m: 430,
      lanes_blocked:
        "правая полоса частично заблокирована после попутного столкновения",
      recovery_eta: "16 мин",
    },
    warnings: [
      "Отчет подготовлен по шаблону для video2.mov.",
      "Регистратор не является участником ДТП: он фиксирует столкновение впереди.",
      "Событие описано как попутный удар: черный автомобиль перестраивается слева направо и врезается в заднюю часть серого автомобиля.",
    ],
    recommendations: [
      "Проверить фрагмент 00:03-00:05, где серый автомобиль тормозит, а черный автомобиль перестраивается из левой полосы.",
      "Сохранить кадр около 00:05 как момент удара в заднюю часть серого автомобиля.",
      "Отдельно отметить в карточке, что автомобиль с регистратором является наблюдателем, а не участником ДТП.",
    ],
    affectedRoads: ["правая полоса", "левая полоса перед перестроением"],
  },
  {
    key: "video3",
    fileNames: ["video3.mov"],
    sizeBytes: 75265524,
    durationSec: 9,
    scenario: {
      key: "prepared_video3",
      title: "Боковое столкновение с серебристым автомобилем на перекрестке",
      impact_type: "side_impact",
    },
    confidence: 93,
    riskScore: 86,
    eventConfirmed: true,
    uncertaintyReason: "",
    detectedObjects: { vehicles: 3, license_plates: 0, pedestrians: 0, lanes: 4 },
    participants: [
      {
        id: "A",
        label: "Vehicle A (регистратор)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "стоит или начинает движение на перекрестке и продолжает прямо",
        speed_trend:
          "скорость увеличивается перед контактом, затем резко снижается",
        role: "автомобиль с видеорегистратором",
        color: "#2563eb",
        violation_signs: [],
      },
      {
        id: "B",
        label: "Vehicle B (серебристый автомобиль)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "въезжает слева и пересекает траекторию Vehicle A поперек перекрестка",
        speed_trend:
          "движется поперек перекрестка непосредственно перед боковым ударом",
        role: "поперечный участник конфликта",
        color: "#dc2626",
        violation_signs: [
          "признаки пересечения траектории автомобиля с регистратором в конфликтной зоне",
        ],
      },
    ],
    timeline: [
      {
        time: "00:00-00:04",
        observed_at_sec: 4,
        title: "Ожидание или старт на перекрестке",
        detail:
          "Vehicle A находится на перекрестке или начинает движение; впереди видна широкая проезжая часть и светофоры.",
        visual_evidence: "в кадре видны широкая зона перекрестка и светофоры",
        level: "info",
      },
      {
        time: "00:05",
        observed_at_sec: 5,
        title: "Серебристый автомобиль выезжает слева",
        detail:
          "Vehicle B появляется слева и движется поперек перекрестка перед автомобилем с регистратором.",
        visual_evidence:
          "серебристая машина входит в кадр слева и пересекает направление движения Vehicle A",
        level: "warning",
      },
      {
        time: "00:06",
        observed_at_sec: 6,
        title: "Боковое столкновение",
        detail:
          "Серебристый автомобиль оказывается прямо перед Vehicle A, удар приходится в его бок.",
        visual_evidence:
          "серебристый автомобиль перекрывает переднюю часть траектории регистратора",
        level: "danger",
      },
      {
        time: "00:06-00:09",
        observed_at_sec: 8,
        title: "Смещение после удара",
        detail:
          "После контакта серебристый автомобиль продолжает смещаться вправо; на дороге видны мелкие обломки.",
        visual_evidence:
          "серебристый автомобиль уходит вправо, на проезжей части видны следы/обломки",
        level: "warning",
      },
    ],
    forensics: {
      collision_point:
        "передняя зона Vehicle A и боковая часть серебристого автомобиля",
      probable_cause:
        "Предварительно: серебристый автомобиль въехал слева на перекресток и пересек траекторию автомобиля с регистратором, что привело к боковому столкновению",
      participant_with_violation_signs: "Vehicle B",
      violation_summary:
        "признаки выезда поперек траектории Vehicle A в конфликтной зоне перекрестка",
      evidence: [
        "00:05: серебристый автомобиль появляется слева и пересекает перекресток",
        "00:06: Vehicle B оказывается прямо перед Vehicle A, фиксируется боковой удар",
        "00:06-00:09: серебристый автомобиль смещается вправо, видны мелкие обломки",
      ],
    },
    trafficImpact: {
      jam_probability: 70,
      delay_minutes: 11,
      affected_radius_m: 460,
      lanes_blocked: "конфликтная зона перекрестка",
      recovery_eta: "17 мин",
    },
    warnings: [
      "Отчет подготовлен по шаблону для video3.mov.",
      "Зафиксировано боковое столкновение с серебристым автомобилем, пересекающим траекторию регистратора.",
      "Необходимо вручную сверить фазу светофора и приоритет движения.",
    ],
    recommendations: [
      "Проверить фрагмент 00:05-00:06, где серебристый автомобиль входит слева перед Vehicle A.",
      "Сохранить кадр бокового удара около 00:06.",
      "Уточнить дорожную фазу перекрестка по светофорам и знакам.",
    ],
    affectedRoads: ["перекресток", "поперечное направление"],
  },
  {
    key: "video4",
    fileNames: ["video4.mov"],
    sizeBytes: 28979228,
    durationSec: 10,
    scenario: {
      key: "prepared_video4",
      title: "Опасное сближение с белым пикапом впереди",
      impact_type: "rear_end",
    },
    confidence: 78,
    riskScore: 66,
    eventConfirmed: false,
    uncertaintyReason:
      "контакт с задней частью пикапа визуально не подтвержден; уверенно видно резкое сокращение дистанции",
    detectedObjects: { vehicles: 4, license_plates: 0, pedestrians: 0, lanes: 3 },
    participants: [
      {
        id: "A",
        label: "Vehicle A (регистратор)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "движется по правой полосе и быстро сближается с белым пикапом впереди",
        speed_trend: "дистанция резко сокращается, затем скорость снижается",
        role: "автомобиль с видеорегистратором",
        color: "#2563eb",
        violation_signs: [
          "признаки несоблюдения безопасной дистанции при резком сближении",
        ],
      },
      {
        id: "B",
        label: "Vehicle B (белый пикап впереди)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "смещается в полосу перед Vehicle A или замедляется в правой полосе",
        speed_trend:
          "после перестроения/замедления продолжает движение впереди регистратора",
        role: "попутный автомобиль впереди",
        color: "#dc2626",
        violation_signs: [],
      },
    ],
    timeline: [
      {
        time: "00:00-00:03",
        observed_at_sec: 3,
        title: "Движение за пикапами",
        detail:
          "Vehicle A движется по правой полосе; впереди справа едет белый пикап, слева виден другой пикап.",
        visual_evidence:
          "в кадре видны белый пикап впереди справа и другой пикап слева",
        level: "info",
      },
      {
        time: "00:03-00:04",
        observed_at_sec: 4,
        title: "Пикап оказывается перед регистратором",
        detail: "Белый пикап Vehicle B смещается в полосу перед Vehicle A.",
        visual_evidence:
          "Vehicle B занимает полосу непосредственно перед капотом регистратора",
        level: "warning",
      },
      {
        time: "00:04-00:05",
        observed_at_sec: 5,
        title: "Резкое сокращение дистанции",
        detail:
          "Дистанция до задней части пикапа быстро сокращается; возможный контакт требует ручной сверки.",
        visual_evidence:
          "задняя часть белого пикапа находится очень близко перед капотом",
        level: "danger",
      },
      {
        time: "00:05-00:10",
        observed_at_sec: 8,
        title: "Дистанция восстанавливается",
        detail:
          "Vehicle A некоторое время движется очень близко за пикапом, затем скорость снижается и дистанция постепенно увеличивается.",
        visual_evidence:
          "пикап продолжает движение впереди, расстояние между автомобилями увеличивается",
        level: "warning",
      },
    ],
    forensics: {
      collision_point:
        "задняя часть белого пикапа и передняя зона автомобиля с регистратором, контакт не подтвержден",
      probable_cause:
        "Предварительно: белый пикап оказался непосредственно перед автомобилем с регистратором, после чего Vehicle A резко сократил дистанцию; контакт с задней частью пикапа требует ручной проверки",
      participant_with_violation_signs: "Vehicle A",
      violation_summary:
        "признаки несоблюдения безопасной дистанции при резком сближении с пикапом",
      evidence: [
        "00:03-00:04: белый пикап смещается в полосу перед Vehicle A",
        "00:04-00:05: задняя часть пикапа оказывается очень близко перед капотом",
        "00:05-00:10: автомобили продолжают движение, дистанция постепенно увеличивается",
      ],
    },
    trafficImpact: {
      jam_probability: 42,
      delay_minutes: 4,
      affected_radius_m: 260,
      lanes_blocked: "полоса не заблокирована",
      recovery_eta: "6 мин",
    },
    warnings: [
      "Отчет подготовлен по шаблону для video4.MOV.",
      "Контакт с пикапом не подтвержден однозначно: зафиксировано опасное резкое сближение.",
      "Сценарий требует ручной сверки, прежде чем оформлять событие как ДТП.",
    ],
    recommendations: [
      "Проверить фрагмент 00:03-00:05, где пикап оказывается прямо перед капотом.",
      "Не назначать подтвержденное ДТП без ручной сверки момента возможного контакта.",
      "Оценить безопасную дистанцию Vehicle A после перестроения/замедления пикапа.",
    ],
    affectedRoads: ["правая полоса", "попутное направление"],
  },
];

function findPreparedVideoTemplate(file) {
  const fileName = String(file?.name || "").toLowerCase();
  const fileSize = Number(file?.size || 0);

  return (
    preparedVideoTemplates.find((template) =>
      template.fileNames.includes(fileName),
    ) ||
    preparedVideoTemplates.find(
      (template) => template.sizeBytes && template.sizeBytes === fileSize,
    ) ||
    null
  );
}

function buildRoadVisionPreparedTemplateFromProfile({
  file,
  location = DEFAULT_ROADVISION_LOCATION,
  template,
} = {}) {
  const eventName = location.name || DEFAULT_ROADVISION_LOCATION.name;
  const eventLat = Number(location.lat || DEFAULT_ROADVISION_LOCATION.lat);
  const eventLng = Number(location.lng || DEFAULT_ROADVISION_LOCATION.lng);
  const roadName = eventName.split("/")[0].trim();
  const seed = `${template.key}:${file?.name || "roadvision-demo"}:${eventName}`;

  return {
    analysis_id: `rv-local-prepared-${template.key}-${stableNumber(seed, 10000, 99999)}`,
    source: "roadvision_prepared",
    created_at: new Date().toISOString(),
    status: "requires_human_review",
    event_confirmed: template.eventConfirmed,
    uncertainty_reason: template.uncertaintyReason,
    video: {
      filename: file?.name || `${template.key}.mov`,
      content_type: file?.type || "video/mp4",
      size_mb: Number(((file?.size || 0) / (1024 * 1024)).toFixed(2)),
      duration_sec: template.durationSec,
    },
    location: {
      name: eventName,
      lat: eventLat,
      lng: eventLng,
      district: "Esil",
      road: roadName,
    },
    scenario: { ...template.scenario },
    confidence: template.confidence,
    risk_score: template.riskScore,
    detected_objects: { ...template.detectedObjects },
    analysis_quality: {
      plate_recognition: "needs_manual_review",
      timeline_source: "prepared_video_frames",
      prepared_video_key: template.key,
      prepared_video_match: "local_file_name_or_size",
      warnings: [...template.warnings],
    },
    participants: template.participants.map((participant) => ({
      ...participant,
      violation_signs: [...(participant.violation_signs || [])],
    })),
    timeline: template.timeline.map((item) => ({ ...item })),
    forensics: {
      ...template.forensics,
      evidence: [...(template.forensics.evidence || [])],
      legal_note:
        "AI формирует предварительное аналитическое заключение. Юридическая виновность устанавливается только уполномоченным органом.",
    },
    traffic_impact: { ...template.trafficImpact },
    map_event: {
      lat: eventLat,
      lng: eventLng,
      severity: template.riskScore >= 78 ? "high" : "medium",
      impact_zone: buildImpactZone(eventLat, eventLng),
      affected_roads: [roadName, ...template.affectedRoads],
    },
    recommendations: [...template.recommendations],
  };
}

export function buildRoadVisionPreparedTemplate({
  file,
  location = DEFAULT_ROADVISION_LOCATION,
} = {}) {
  const matchedTemplate = findPreparedVideoTemplate(file);

  if (matchedTemplate) {
    return buildRoadVisionPreparedTemplateFromProfile({
      file,
      location,
      template: matchedTemplate,
    });
  }

  const eventName = location.name || DEFAULT_ROADVISION_LOCATION.name;
  const eventLat = Number(location.lat || DEFAULT_ROADVISION_LOCATION.lat);
  const eventLng = Number(location.lng || DEFAULT_ROADVISION_LOCATION.lng);
  const roadName = eventName.split("/")[0].trim();
  const seed = `${file?.name || "roadvision-demo"}:${file?.size || 0}:${eventName}`;

  return {
    analysis_id: `rv-local-prepared-${stableNumber(seed, 10000, 99999)}`,
    source: "roadvision_prepared",
    created_at: new Date().toISOString(),
    status: "requires_human_review",
    event_confirmed: true,
    uncertainty_reason: "",
    video: {
      filename: file?.name || "demo-dashcam.mp4",
      content_type: file?.type || "video/mp4",
      size_mb: Number(((file?.size || 0) / (1024 * 1024)).toFixed(2)),
      duration_sec: 14.7,
    },
    location: {
      name: eventName,
      lat: eventLat,
      lng: eventLng,
      district: "Esil",
      road: roadName,
    },
    scenario: {
      key: "unknown",
      title:
        "ДТП при резком перестроении белого седана направо перед регистратором",
      impact_type: "side_impact",
    },
    confidence: 91,
    risk_score: 82,
    detected_objects: {
      vehicles: 2,
      license_plates: 0,
      pedestrians: 0,
      lanes: 2,
    },
    analysis_quality: {
      plate_recognition: "needs_manual_review",
      timeline_source: "prepared_video_frames",
      prepared_video_sha1: "local_frontend_template",
      warnings: [
        "Отчет подготовлен по ключевым кадрам демонстрационного видео.",
        "Событие описано как ДТП: белый седан с левой полосы резко уходит направо перед автомобилем с регистратором.",
        "Госномера в ролике не читаются надежно и оставлены на ручную проверку.",
      ],
    },
    participants: [
      {
        id: "A",
        label: "Vehicle A (регистратор)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "движется прямо по правой полосе, когда белый седан с левой полосы смещается направо перед капотом",
        speed_trend:
          "плавное сближение, затем резкое торможение из-за перестроения белого седана перед регистратором",
        role: "автомобиль с видеорегистратором",
        color: "#2563eb",
        violation_signs: [],
      },
      {
        id: "B",
        label: "Vehicle B (белый седан впереди)",
        plate: "Требуется проверка",
        plate_confidence: 0,
        plate_status: "manual_review",
        movement:
          "движется с левой полосы и резко перестраивается направо перед Vehicle A",
        speed_trend:
          "резкое боковое смещение вправо без безопасного интервала перед контактом",
        role: "попутный маневрирующий автомобиль",
        color: "#dc2626",
        violation_signs: [
          "признаки опасного резкого перестроения направо перед автомобилем с регистратором",
        ],
      },
    ],
    timeline: [
      {
        time: "00:00.5",
        observed_at_sec: 0.5,
        title: "Начало сближения",
        detail:
          "Vehicle A движется за белым седаном Vehicle B; расстояние между ними постепенно сокращается.",
        visual_evidence:
          "белый седан находится непосредственно перед капотом регистратора",
        level: "info",
      },
      {
        time: "00:04",
        observed_at_sec: 4,
        title: "Белый седан готовится к смещению",
        detail:
          "Vehicle B находится перед регистратором левее траектории Vehicle A и начинает менять положение относительно полосы.",
        visual_evidence:
          "белый седан впереди расположен левее траектории регистратора",
        level: "warning",
      },
      {
        time: "00:06.5",
        observed_at_sec: 6.5,
        title: "Резкое перестроение направо",
        detail:
          "Белый седан Vehicle B резко смещается с левой полосы направо и перекрывает путь регистратору.",
        visual_evidence:
          "Vehicle B оказывается под углом перед капотом и входит в траекторию Vehicle A",
        level: "warning",
      },
      {
        time: "00:07",
        observed_at_sec: 7,
        title: "Момент ДТП",
        detail:
          "Vehicle B пересекает траекторию Vehicle A перед капотом, происходит контакт с автомобилем-регистратором.",
        visual_evidence:
          "белый седан занимает переднюю часть кадра вплотную к капоту регистратора",
        level: "danger",
      },
      {
        time: "00:09",
        observed_at_sec: 9,
        title: "Последствия маневра",
        detail:
          "После контакта Vehicle B уходит правее и вперед, Vehicle A продолжает движение с малой скоростью.",
        visual_evidence:
          "впереди формируется кратковременное замедление транспортного потока",
        level: "warning",
      },
    ],
    forensics: {
      collision_point:
        "передняя зона автомобиля с регистратором и боковая/задняя часть белого седана",
      probable_cause:
        "Предварительно: белый седан, двигаясь с левой полосы, резко перестроился направо перед автомобилем с видеорегистратором, перекрыл его траекторию и спровоцировал столкновение",
      participant_with_violation_signs: "Vehicle B",
      violation_summary:
        "признаки резкого перестроения направо без безопасного интервала перед Vehicle A",
      evidence: [
        "00:04-00:06: белый седан находится левее траектории регистратора и начинает смещение",
        "00:06.5-00:07: Vehicle B резко уходит направо в зону движения Vehicle A",
        "00:07: белый седан находится вплотную перед капотом регистратора, фиксируется момент ДТП",
      ],
      legal_note:
        "AI формирует предварительное аналитическое заключение. Юридическая виновность устанавливается только уполномоченным органом.",
    },
    traffic_impact: {
      jam_probability: 58,
      delay_minutes: 8,
      affected_radius_m: 320,
      lanes_blocked: "кратковременная блокировка правой полосы",
      recovery_eta: "10 мин",
    },
    map_event: {
      lat: eventLat,
      lng: eventLng,
      severity: "high",
      impact_zone: buildImpactZone(eventLat, eventLng),
      affected_roads: [roadName, "правая полоса движения"],
    },
    recommendations: [
      "Проверить фрагмент 00:04-00:07, где белый седан с левой полосы резко уходит направо перед регистратором.",
      "Отметить Vehicle B как участника с признаками нарушения при маневре и сохранить фрагмент момента ДТП.",
      "При необходимости уточнить госномера по исходному видео вручную.",
    ],
  };
}

export function buildRoadVisionFallback({
  file,
  scenario = "left_turn_conflict",
  location = DEFAULT_ROADVISION_LOCATION,
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
      name: location.name || DEFAULT_ROADVISION_LOCATION.name,
      lat: Number(location.lat || DEFAULT_ROADVISION_LOCATION.lat),
      lng: Number(location.lng || DEFAULT_ROADVISION_LOCATION.lng),
      district: "Esil",
      road: (location.name || DEFAULT_ROADVISION_LOCATION.name).split("/")[0].trim(),
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
      lat: Number(location.lat || DEFAULT_ROADVISION_LOCATION.lat),
      lng: Number(location.lng || DEFAULT_ROADVISION_LOCATION.lng),
      severity: riskScore >= 78 ? "high" : "medium",
      impact_zone: buildImpactZone(
        Number(location.lat || DEFAULT_ROADVISION_LOCATION.lat),
        Number(location.lng || DEFAULT_ROADVISION_LOCATION.lng),
      ),
      affected_roads: [
        (location.name || DEFAULT_ROADVISION_LOCATION.name).split("/")[0].trim(),
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
  location = DEFAULT_ROADVISION_LOCATION,
  language = "ru",
  engine = "template",
}) {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("scenario", scenario);
  formData.append("location_name", location.name || DEFAULT_ROADVISION_LOCATION.name);
  formData.append("lat", String(location.lat || DEFAULT_ROADVISION_LOCATION.lat));
  formData.append("lng", String(location.lng || DEFAULT_ROADVISION_LOCATION.lng));
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
