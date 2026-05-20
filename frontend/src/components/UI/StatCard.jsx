import styles from "./StatCard.module.css";

const accentClassByColor = {
  "#ef4444": styles.accentRed,
  "#8b5cf6": styles.accentPurple,
  "#3b82f6": styles.accentBlue,
  "#2563eb": styles.accentBlue,
};

export default function StatCard({
  title,
  value,
  subtitle,
  accent = "#2563eb",
  className = "",
}) {
  const accentClass = accentClassByColor[accent] || styles.accentBlue;

  return (
    <div
      className={["stat-card", styles.card, accentClass, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.glow} />

      <div className={styles.content}>
        <div className={styles.label}>{title}</div>
        <div className={styles.value}>{value}</div>
      </div>

      {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
    </div>
  );
}
