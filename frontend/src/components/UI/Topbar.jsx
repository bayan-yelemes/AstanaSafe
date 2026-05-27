import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { AlertTriangle, Calendar, Plus } from "./icons";
import { enGB, kk, ru } from "date-fns/locale";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./Topbar.module.css";

const titleKeys = {
  Dashboard: "nav.dashboard",
  Analytics: "nav.analytics",
  Reports: "nav.reports",
  Forecast: "nav.forecast",
  Account: "nav.account",
  Settings: "nav.settings",
  "Диспетчерская": "nav.dispatcher",
  "Мои SOS-заявки": "nav.mySos",
  "Опасные участки": "nav.dangerZones",
  "Паспорт района": "nav.districtPassport",
  "Сценарии реагирования": "nav.responseScenarios",
  "Администратор": "nav.admin",
};

const dateLocales = {
  en: enGB,
  ru,
  kz: kk,
};

export default function Topbar({
  title,
  titleKey,
  showTrafficAction = true,
  showEmergencyAction = true,
}) {
  const { language, t } = useI18n();
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const fetchAccidents = useAppStore((state) => state.fetchAccidents);
  const fetchHeatmap = useAppStore((state) => state.fetchHeatmap);
  const fetchWeather = useAppStore((state) => state.fetchWeather);
  const currentUser = useAppStore((state) => state.currentUser);
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const openTrafficJamModal = useAppStore((state) => state.openTrafficJamModal);
  const openSosModal = useAppStore((state) => state.openSosModal);

  const displayTitle = titleKey
    ? t(titleKey)
    : titleKeys[title]
      ? t(titleKeys[title])
      : title;

  const handleDateChange = (date) => {
    setSelectedDate(date);

    setTimeout(() => {
      fetchAccidents();
      fetchHeatmap();
      fetchWeather();
    }, 0);
  };

  const handleMarkClick = () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }

    openTrafficJamModal();
  };

  const handleSosClick = () => {
    if (!currentUser) {
      openAuthModal();
      return;
    }

    openSosModal();
  };

  return (
    <div
      className={["app-topbar", styles.topbar].filter(Boolean).join(" ")}
    >
      <div className={styles.leftGroup}>
        <div className={styles.title}>{displayTitle}</div>

        <div className={styles.divider} />

        <div className={styles.datePicker}>
          <Calendar size={17} color="var(--primary)" />

          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="d MMMM, yyyy"
            locale={dateLocales[language] || enGB}
            wrapperClassName="topbar-datepicker"
            popperClassName="app-datepicker-popper"
            calendarClassName="app-datepicker-calendar"
            popperPlacement="bottom-start"
            onKeyDown={(event) => event.preventDefault()}
            onPaste={(event) => event.preventDefault()}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <LanguageSwitcher />

        {showEmergencyAction ? (
          <button
            type="button"
            onClick={handleSosClick}
            className={styles.sosButton}
          >
            <AlertTriangle size={18} />
            <span>SOS</span>
          </button>
        ) : null}

        {showTrafficAction ? (
          <button
            type="button"
            onClick={handleMarkClick}
            className={styles.trafficButton}
          >
            <Plus size={18} />
            <span>{t("topbar.markTrafficJam")}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
