import styles from "./Navbar.module.css";
export default function Navbar() {
  return (
    <div className={styles.navbarStyle1}>
      <h1 className={styles.navbarStyle2}>AstanaSafe Dashboard</h1>
      <p className={styles.navbarStyle3}>
        Real-time accident monitoring system for Astana
      </p>
    </div>
  );
}
