import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { resetPassword } from "../services/authService";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { Lock, ShieldCheck } from "../components/UI/icons";
import LanguageSwitcher from "../components/UI/LanguageSwitcher";
import styles from "./ResetPassword.module.css";

export default function ResetPassword() {
  const { t } = useI18n();
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(
    token ? "" : t("resetPasswordPage.tokenMissing"),
  );

  const isSubmitting = status === "loading";
  const isSuccess = status === "success";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!token) {
      setMessage(t("resetPasswordPage.tokenMissing"));
      return;
    }

    if (password.trim().length < 6) {
      setMessage(t("resetPasswordPage.minLength"));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t("resetPasswordPage.mismatch"));
      return;
    }

    try {
      setStatus("loading");
      await resetPassword({ token, password: password.trim() });
      setStatus("success");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus("error");
      setMessage(error?.response?.data?.detail || t("resetPasswordPage.invalidLink"));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.languageCorner}>
        <LanguageSwitcher />
      </div>

      <section className={styles.panel}>
        {isSuccess ? (
          <div className={styles.successBlock}>
            <div className={styles.resetHeader}>
              <div className={styles.brandLine}>
                <span className={styles.brandIcon}>
                  <ShieldCheck size={18} />
                </span>
                <span>AstanaSafe</span>
              </div>

              <span className={styles.successIcon}>
                <ShieldCheck size={28} />
              </span>
            </div>

            <h1>{t("resetPasswordPage.successTitle")}</h1>
            <p>{t("resetPasswordPage.successText")}</p>
            <div className={styles.actionGrid}>
              <button
                type="button"
                onClick={openAuthModal}
                className={styles.primaryBtn}
              >
                {t("auth.signIn")}
              </button>
              <Link to="/" className={styles.secondaryBtn}>
                {t("resetPasswordPage.backHome")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.resetHeader}>
              <div className={styles.brandLine}>
                <span className={styles.brandIcon}>
                  <ShieldCheck size={18} />
                </span>
                <span>AstanaSafe</span>
              </div>

              <div className={styles.headingIcon}>
                <Lock size={24} />
              </div>
            </div>

            <h1>{t("resetPasswordPage.title")}</h1>
            <p className={styles.subtitle}>{t("resetPasswordPage.subtitle")}</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.fieldLabel}>
                {t("resetPasswordPage.newPassword")}
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("resetPasswordPage.newPasswordPlaceholder")}
                  className={styles.input}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </label>

              <label className={styles.fieldLabel}>
                {t("resetPasswordPage.confirmPassword")}
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t("resetPasswordPage.confirmPasswordPlaceholder")}
                  className={styles.input}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </label>

              {message && <div className={styles.error}>{message}</div>}

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className={styles.primaryBtn}
              >
                {isSubmitting
                  ? t("resetPasswordPage.submitting")
                  : t("resetPasswordPage.submit")}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
