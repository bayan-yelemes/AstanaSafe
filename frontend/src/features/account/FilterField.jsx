import styles from "../../pages/Account.module.css";

export default function FilterField({ label, children }) {
  return (
    <div className={styles.accountStyle1}>
      <div className={styles.accountStyle2}>{label}</div>
      {children}
    </div>
  );
}
