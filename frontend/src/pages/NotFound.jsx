import { Link } from "react-router-dom";

import Topbar from "../components/UI/Topbar";
import { AlertTriangle, LayoutDashboard } from "../components/UI/icons";
import { useI18n } from "../i18n";
import styles from "./NotFound.module.css";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div>
      <Topbar
        titleKey="notFound.title"
        showEmergencyAction={false}
        showTrafficAction={false}
      />

      <section className={styles.shell}>
        <div className={styles.iconWrap}>
          <AlertTriangle size={32} />
        </div>

        <div>
          <p className={styles.kicker}>404</p>
          <h1>{t("notFound.title")}</h1>
          <p className={styles.description}>{t("notFound.description")}</p>
        </div>

        <Link to="/" className={styles.action}>
          <LayoutDashboard size={18} />
          {t("notFound.action")}
        </Link>
      </section>
    </div>
  );
}
