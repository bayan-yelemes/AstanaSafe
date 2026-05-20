import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "./icons";
import { useI18n } from "../../i18n";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher() {
  const { language, setLanguage, languages, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLanguage =
    languages.find((item) => item.code === language) || languages[1];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!ref.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className={styles.languageSwitcherStyle1}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={t("language.tooltip")}
        style={{
          height: "46px",
          minWidth: "82px",
          border: "1px solid var(--primary-border)",
          background: open ? "var(--primary-soft)" : "var(--surface)",
          color: "var(--primary)",
          borderRadius: "16px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "7px",
          padding: "0 14px",
          cursor: "pointer",
          fontWeight: 850,
          boxShadow: open ? "0 12px 28px rgba(37,99,235,0.14)" : "none",
        }}
      >
        <Globe2 size={16} />
        <span className={styles.languageSwitcherStyle2}>
          {currentLanguage.short}
        </span>
        <ChevronDown
          size={14}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s ease",
          }}
        />
      </button>

      {open ? (
        <div
          className={["motion-dropdown", styles.languageSwitcherStyle3]
            .filter(Boolean)
            .join(" ")}
        >
          {languages.map((item) => {
            const active = item.code === language;

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelect(item.code)}
                style={{
                  width: "100%",
                  height: "40px",
                  border: "none",
                  borderRadius: "10px",
                  background: active ? "var(--primary-soft)" : "var(--surface)",
                  color: active ? "var(--primary)" : "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: active ? 900 : 750,
                }}
              >
                <span>{item.short}</span>
                {active ? (
                  <span className={styles.languageSwitcherStyle4}>
                    <Check size={12} />
                    {t("language.active")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
