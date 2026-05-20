export function getRiskColor(level) {
  if (level === "HIGH") return "#ef4444";
  if (level === "MEDIUM") return "#f59e0b";
  return "#16a34a";
}

export function getRiskTint(level) {
  if (level === "HIGH") return "#fff1f2";
  if (level === "MEDIUM") return "#fffbeb";
  return "#f0fdf4";
}

const RISK_PANEL_COPY = {
  en: {
    mlZoneScan: "ML Zone Scan",
    mlSafetyZone: "ML Safety Zone",
    analyzingArea: "Analyzing selected area",
    calculatingRisk: "Calculating zone risk...",
    riskUnavailable: "Risk analysis is unavailable right now.",
    noCloseIntersection: "No close intersection detected",
    accidents: "Accidents",
    reports: "Reports",
    peak: "Peak",
    mainFactors: "Main Factors",
    lowerRisk: "What Could Lower Risk",
    markAtPoint: "Mark report at this point",
    unknownDistrict: "Unknown district",
    thisPartOfAstana: "this part of Astana",
    noPeakData: "not enough data",
    riskLevels: {
      HIGH: "High",
      MEDIUM: "Medium",
      LOW: "Low",
      UNKNOWN: "Unknown",
    },
    riskBadge: (level) => `${level} risk`,
    explanation: ({ level, score, accidents, reports, place, peak }) =>
      `This zone is classified as ${level.toLowerCase()} risk with a score of ${score}/100. The model found ${accidents} historical accidents and ${reports} user reports near ${place}. The strongest pressure point is around ${peak}, so the dashboard treats this area as a local safety zone rather than a single map point.`,
    reasons: {
      accidents: (count) =>
        `${count} historical accidents were found inside the selected zone.`,
      noAccidents:
        "No historical accident cluster was found inside the selected zone.",
      activeJams: (count) =>
        `${count} active traffic reports are adding live pressure here.`,
      userReports: (count) =>
        `${count} user incident reports are connected to this area.`,
      nearIntersection: (road, crossroad, distance) =>
        `Nearest intersection: ${road}${crossroad ? ` / ${crossroad}` : ""}, about ${distance} m away.`,
      badWeather: (weather) =>
        `${weather} weather can reduce visibility and braking distance.`,
      peakHour: (hour) => `Peak activity is concentrated around ${hour}.`,
      aboveBaseline:
        "The score is above the city baseline, so this point needs attention.",
      moderate:
        "The zone has moderate pressure and should be watched during busy hours.",
      low: "The zone looks relatively calm based on available data.",
    },
    interventions: {
      speedCalming: {
        name: "Speed calming",
        detail:
          "Add speed control, warning signs, or lane narrowing near the risk cluster.",
      },
      signalTiming: {
        name: "Signal timing review",
        detail:
          "Review signal phases and turning intervals at the nearest intersection.",
      },
      lighting: {
        name: "Lighting and visibility",
        detail:
          "Improve lighting, lane markings, and pedestrian visibility near the zone.",
      },
      congestion: {
        name: "Congestion warning",
        detail:
          "Warn drivers earlier when user reports start clustering nearby.",
      },
      default: {
        name: "Prevention action",
        detail:
          "Apply a local safety measure based on the detected risk pattern.",
      },
    },
  },
  ru: {
    mlZoneScan: "ML-сканирование зоны",
    mlSafetyZone: "ML-зона безопасности",
    analyzingArea: "Анализ выбранной зоны",
    calculatingRisk: "ML рассчитывает риск зоны...",
    riskUnavailable: "Анализ риска сейчас недоступен.",
    noCloseIntersection: "Рядом не найден перекресток",
    accidents: "ДТП",
    reports: "Отчеты",
    peak: "Пик",
    mainFactors: "Главные факторы",
    lowerRisk: "Что снизит риск",
    markAtPoint: "Отметить отчет в этой точке",
    unknownDistrict: "Неизвестный район",
    thisPartOfAstana: "этой части Астаны",
    noPeakData: "недостаточно данных",
    riskLevels: {
      HIGH: "Высокий",
      MEDIUM: "Средний",
      LOW: "Низкий",
      UNKNOWN: "Неизвестный",
    },
    riskBadge: (level) => `${level} риск`,
    explanation: ({ level, score, accidents, reports, place, peak }) =>
      `Эта зона получила уровень «${level.toLowerCase()}» и оценку ${score}/100. Модель нашла ${accidents} исторических ДТП и ${reports} пользовательских отметок рядом с ${place}. Самая заметная нагрузка приходится на ${peak}, поэтому дашборд рассматривает это место как локальную зону риска, а не просто одну точку на карте.`,
    reasons: {
      accidents: (count) =>
        `В выбранной зоне найдено исторических ДТП: ${count}.`,
      noAccidents: "Исторического кластера ДТП в выбранной зоне не найдено.",
      activeJams: (count) =>
        `${count} активных пользовательских отметок усиливают нагрузку здесь.`,
      userReports: (count) =>
        `${count} пользовательских отчетов связаны с этим участком.`,
      nearIntersection: (road, crossroad, distance) =>
        `Ближайший перекресток: ${road}${crossroad ? ` / ${crossroad}` : ""}, примерно ${distance} м.`,
      badWeather: (weather) =>
        `Погода «${weather}» может ухудшать видимость и торможение.`,
      peakHour: (hour) => `Пик активности приходится примерно на ${hour}.`,
      aboveBaseline:
        "Оценка выше городского базового уровня, этот участок стоит проверить внимательнее.",
      moderate: "Зона со средней нагрузкой, за ней лучше следить в часы пик.",
      low: "По доступным данным участок выглядит относительно спокойным.",
    },
    interventions: {
      speedCalming: {
        name: "Успокоение скорости",
        detail:
          "Добавить контроль скорости, предупреждающие знаки или сужение полос рядом с кластером риска.",
      },
      signalTiming: {
        name: "Настройка светофоров",
        detail:
          "Проверить фазы светофора и интервалы поворотов на ближайшем перекрестке.",
      },
      lighting: {
        name: "Освещение и видимость",
        detail:
          "Усилить освещение, разметку и видимость пешеходных зон рядом с участком.",
      },
      congestion: {
        name: "Предупреждение о пробке",
        detail:
          "Показывать раннее предупреждение водителям, когда рядом появляются пользовательские отметки.",
      },
      default: {
        name: "Профилактическая мера",
        detail:
          "Применить локальную меру безопасности по найденному паттерну риска.",
      },
    },
  },
  kz: {
    mlZoneScan: "ML аймақ сканы",
    mlSafetyZone: "ML қауіпсіздік аймағы",
    analyzingArea: "Таңдалған аймақ талдануда",
    calculatingRisk: "Аймақ тәуекелі есептелуде...",
    riskUnavailable: "Тәуекел талдауы қазір қолжетімсіз.",
    noCloseIntersection: "Жақын қиылыс анықталмады",
    accidents: "ЖКО",
    reports: "Есептер",
    peak: "Шарықтау",
    mainFactors: "Негізгі факторлар",
    lowerRisk: "Тәуекелді не азайтады",
    markAtPoint: "Осы нүктеде есеп белгілеу",
    unknownDistrict: "Белгісіз аудан",
    thisPartOfAstana: "Астананың осы бөлігі",
    noPeakData: "дерек жеткіліксіз",
    riskLevels: {
      HIGH: "Жоғары",
      MEDIUM: "Орташа",
      LOW: "Төмен",
      UNKNOWN: "Белгісіз",
    },
    riskBadge: (level) => `${level} тәуекел`,
    explanation: ({ level, score, accidents, reports, place, peak }) =>
      `Бұл аймақ «${level.toLowerCase()}» тәуекел деңгейіне кіріп, ${score}/100 ұпай алды. Модель ${place} маңында ${accidents} тарихи ЖКО және ${reports} пайдаланушы есебін тапты. Ең байқалатын жүктеме ${peak} уақытында, сондықтан дашборд бұл жерді картадағы бір нүкте емес, жергілікті қауіпсіздік аймағы ретінде көрсетеді.`,
    reasons: {
      accidents: (count) =>
        `${count} тарихи ЖКО таңдалған аймақ ішінде табылды.`,
      noAccidents: "Таңдалған аймақта тарихи ЖКО кластері табылған жоқ.",
      activeJams: (count) =>
        `${count} белсенді пайдаланушы есебі бұл жерде жүктемені арттырып тұр.`,
      userReports: (count) =>
        `${count} пайдаланушы есебі осы учаскемен байланысты.`,
      nearIntersection: (road, crossroad, distance) =>
        `Жақын қиылыс: ${road}${crossroad ? ` / ${crossroad}` : ""}, шамамен ${distance} м.`,
      badWeather: (weather) =>
        `${weather} ауа райы көрінуді және тежеу қашықтығын нашарлатуы мүмкін.`,
      peakHour: (hour) => `Белсенділіктің шыңы шамамен ${hour} уақытында.`,
      aboveBaseline:
        "Ұпай қаладағы базалық деңгейден жоғары, бұл учаскеге назар керек.",
      moderate: "Аймақта орташа жүктеме бар, қарбалас уақытта бақылау қажет.",
      low: "Қолда бар деректер бойынша учаске салыстырмалы түрде тыныш.",
    },
    interventions: {
      speedCalming: {
        name: "Жылдамдықты бәсеңдету",
        detail:
          "Қауіп кластері маңына жылдамдық бақылауын, ескерту белгілерін немесе жолақ тарылтуын қосу.",
      },
      signalTiming: {
        name: "Бағдаршам уақытын тексеру",
        detail:
          "Жақын қиылыстағы бағдаршам фазалары мен бұрылыс аралықтарын тексеру.",
      },
      lighting: {
        name: "Жарық және көріну",
        detail:
          "Жарықты, жол таңбасын және жаяу жүргінші аймағының көрінуін күшейту.",
      },
      congestion: {
        name: "Кептеліс ескертуі",
        detail:
          "Жақында пайдаланушы белгілері көбейсе, жүргізушілерге ерте ескерту көрсету.",
      },
      default: {
        name: "Алдын алу шарасы",
        detail:
          "Анықталған тәуекел үлгісіне қарай жергілікті қауіпсіздік шарасын қолдану.",
      },
    },
  },
};

export function getRiskPanelCopy(language) {
  return RISK_PANEL_COPY[language] || RISK_PANEL_COPY.ru;
}
