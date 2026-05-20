import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Cloud,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from "./icons";
import { useI18n } from "../../i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./AuthRequired.module.css";

export default function AuthRequired({ onSignIn }) {
  const { t } = useI18n();
  const previewItems = [
    {
      icon: MapPin,
      label: t("authGate.reports"),
      value: t("authGate.previewReport"),
    },
    {
      icon: ShieldCheck,
      label: t("authGate.scenarios"),
      value: t("authGate.previewScenario"),
    },
    {
      icon: BarChart3,
      label: t("authGate.trafficMarks"),
      value: t("authGate.previewTraffic"),
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.languageCorner}>
        <LanguageSwitcher />
      </div>

      <section className={styles.shell}>
        <div className={styles.content}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>
              <ShieldAlert size={22} />
            </span>
            <div>
              <strong>AstanaSafe</strong>
              <span>{t("authGate.brandNote")}</span>
            </div>
          </div>

          <div className={styles.badge}>
            <Clock3 size={16} />
            <span>{t("authGate.badge")}</span>
          </div>

          <h1>{t("authGate.title")}</h1>
          <p>{t("authGate.description")}</p>

          <button type="button" onClick={onSignIn} className={styles.primaryBtn}>
            <Lock size={18} />
            {t("authGate.action")}
          </button>

          <div className={styles.featureList}>
            {previewItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className={styles.featureItem}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.previewPanel} aria-hidden="true">
          <div className={styles.previewHeader}>
            <div>
              <span>{t("authGate.previewKicker")}</span>
              <strong>{t("authGate.previewTitle")}</strong>
            </div>
            <div className={styles.livePill}>{t("authGate.live")}</div>
          </div>

          <div className={styles.liveBoard}>
            <div className={styles.boardStats}>
              <div className={styles.boardMetric}>
                <Cloud size={17} />
                <span>{t("dashboard.weather")}</span>
                <strong>{"+11\u00b0C"}</strong>
              </div>
              <div className={styles.boardMetric}>
                <AlertTriangle size={17} />
                <span>{t("authGate.previewReportsLabel")}</span>
                <strong>24</strong>
              </div>
              <div className={styles.boardMetric}>
                <ShieldCheck size={17} />
                <span>{t("authGate.previewRiskLabel")}</span>
                <strong>{t("authGate.previewRiskValue")}</strong>
              </div>
            </div>

            <div className={styles.boardGrid}>
              <div className={styles.districtPanel}>
                <div className={styles.panelTitle}>
                  <span>{t("dashboard.districtReports")}</span>
                  <strong>Live</strong>
                </div>

                <div className={styles.districtGrid}>
                  <div className={[styles.districtCell, styles.districtHot].join(" ")}>
                    <span>Almaty</span>
                    <strong>8</strong>
                  </div>
                  <div className={[styles.districtCell, styles.districtWarn].join(" ")}>
                    <span>Esil</span>
                    <strong>5</strong>
                  </div>
                  <div className={styles.districtCell}>
                    <span>Nura</span>
                    <strong>4</strong>
                  </div>
                  <div className={[styles.districtCell, styles.districtCalm].join(" ")}>
                    <span>Saryarka</span>
                    <strong>3</strong>
                  </div>
                </div>
              </div>

              <div className={styles.queuePanel}>
                <div className={styles.panelTitle}>
                  <span>{t("dashboard.recentActivity")}</span>
                  <strong>07:42</strong>
                </div>

                <div className={styles.queueItem}>
                  <span className={styles.queueIcon}>
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <strong>{t("authGate.activityOne")}</strong>
                    <small>{t("authGate.previewReport")}</small>
                  </div>
                </div>

                <div className={styles.queueItem}>
                  <span className={styles.queueIcon}>
                    <ShieldAlert size={16} />
                  </span>
                  <div>
                    <strong>{t("authGate.activityTwo")}</strong>
                    <small>{t("authGate.previewScenario")}</small>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.trendPanel}>
              <div>
                <span>{t("dashboard.activeJams")}</span>
                <strong>{t("authGate.previewTraffic")}</strong>
              </div>
              <div className={styles.trendBars}>
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
