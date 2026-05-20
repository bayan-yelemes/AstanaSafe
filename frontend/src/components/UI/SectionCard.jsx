import styles from "./SectionCard.module.css";

export default function SectionCard({ title, children, className = "" }) {
  return (
    <div className={["surface-card", styles.card, className].filter(Boolean).join(" ")}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {children}
    </div>
  );
}
