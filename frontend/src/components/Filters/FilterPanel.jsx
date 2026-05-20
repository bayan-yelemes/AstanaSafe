import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import styles from "./FilterPanel.module.css";

export default function FilterPanel() {
  const { t, tt, tw } = useI18n();
  const filters = useAppStore((state) => state.filters);
  const setFilter = useAppStore((state) => state.setFilter);

  const handleChange = (key, value) => {
    setFilter(key, value);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>{t("filters.title")}</div>

      <select
        value={filters.district}
        onChange={(e) => handleChange("district", e.target.value)}
        className={styles.select}
      >
        <option value="all">{t("filters.allDistricts")}</option>
        <option value="Almaty">Almaty</option>
        <option value="Baikonur">Baikonur</option>
        <option value="Esil">Esil</option>
        <option value="Nura">Nura</option>
        <option value="Saryarka">Saryarka</option>
        <option value="Saraishyk">Saraishyk</option>
      </select>

      <select
        value={filters.type}
        onChange={(e) => handleChange("type", e.target.value)}
        className={styles.select}
      >
        <option value="all">{t("filters.allTypes")}</option>
        <option value="collision">{tt("collision")}</option>
        <option value="pedestrian">{tt("pedestrian")}</option>
        <option value="rollover">{tt("rollover")}</option>
      </select>

      <select
        value={filters.weather}
        onChange={(e) => handleChange("weather", e.target.value)}
        className={styles.select}
      >
        <option value="all">{t("filters.allWeather")}</option>
        <option value="clear">{tw("clear")}</option>
        <option value="rain">{tw("rain")}</option>
        <option value="snow">{tw("snow")}</option>
        <option value="ice">{tw("ice")}</option>
      </select>
    </div>
  );
}
