import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  FileDown,
  Sparkles,
  User,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  ChevronLeft,
  Database,
  AlertTriangle,
  Analytics,
  MapPin,
} from "./icons";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import styles from "./Sidebar.module.css";

export default function Sidebar({ collapsed = false, onToggle = () => {} }) {
  const { t, language } = useI18n();
  const currentUser = useAppStore((state) => state.currentUser);
  const openAuthModal = useAppStore((state) => state.openAuthModal);

  const isAuthenticated = !!currentUser;
  const currentRole = ["driver", "dispatcher", "admin"].includes(currentUser?.role)
    ? currentUser.role
    : "driver";
  const isDriver = currentRole === "driver";
  const isDispatcher = currentRole === "dispatcher" || currentRole === "admin";
  const isAdmin = currentRole === "admin";

  const userName =
    currentUser?.full_name || currentUser?.name || t("sidebar.guestUser");
  const roleLabels = {
    driver: t("sidebar.driverRole"),
    dispatcher: t("sidebar.dispatcherRole"),
    admin: t("sidebar.adminRole"),
  };
  const groupLabels =
    {
      ru: {
        monitoring: "Мониторинг",
        analytics: "Аналитика",
        ai: "AI-модули",
        personal: "Личный доступ",
      },
      en: {
        monitoring: "Monitoring",
        analytics: "Analytics",
        ai: "AI modules",
        personal: "Personal",
      },
      kz: {
        monitoring: "Мониторинг",
        analytics: "Аналитика",
        ai: "AI модульдері",
        personal: "Жеке қолжетім",
      },
    }[language] || {
      monitoring: "Мониторинг",
      analytics: "Аналитика",
      ai: "AI-модули",
      personal: "Личный доступ",
    };

  const navGroups = [
    {
      key: "monitoring",
      label: groupLabels.monitoring,
      items: [
        { label: t("nav.dashboard"), to: "/", icon: LayoutDashboard },
        { label: t("nav.dangerZones"), to: "/danger-zones", icon: AlertTriangle },
        ...(isDispatcher
          ? [{ label: t("nav.dispatcher"), to: "/dispatcher", icon: ShieldAlert }]
          : []),
      ],
    },
    {
      key: "analytics",
      label: groupLabels.analytics,
      items: [
        { label: t("nav.analytics"), to: "/analytics", icon: BarChart3 },
        { label: t("nav.districtPassport"), to: "/district-passport", icon: Analytics },
        { label: t("nav.reports"), to: "/reports", icon: FileDown },
      ],
    },
    {
      key: "ai",
      label: groupLabels.ai,
      items: [
        { label: t("nav.forecast"), to: "/forecast", icon: Sparkles },
        { label: "RoadVision AI", to: "/roadvision", icon: ShieldAlert },
        { label: t("nav.responseScenarios"), to: "/response-scenarios", icon: ShieldCheck },
      ],
    },
    {
      key: "personal",
      label: groupLabels.personal,
      items: [
        ...(isAuthenticated && isDriver
          ? [{ label: t("nav.mySos"), to: "/my-sos", icon: MapPin }]
          : []),
        ...(isAdmin
          ? [{ label: t("nav.admin"), to: "/admin", icon: Database }]
          : []),
      ],
    },
  ];

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(Boolean),
    }))
    .filter((group) => group.items.length);

  const handleBottomCardClick = () => {
    if (!isAuthenticated) {
      openAuthModal();
    }
  };

  return (
    <aside
      className="app-sidebar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: collapsed ? "96px" : "288px",
        minWidth: collapsed ? "96px" : "288px",
        height: "100vh",
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        borderRight: "1px solid rgba(226,232,240,0.9)",
        padding: collapsed ? "22px 14px" : "24px 18px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.26s ease",
        overflow: "visible",
        boxShadow: "10px 0 38px rgba(15,23,42,0.04)",
        zIndex: 30,
      }}
    >
      <button type="button" onClick={onToggle} className={styles.sidebarStyle1}>
        <ChevronLeft
          size={14}
          color="#94a3b8"
          style={{
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
          }}
        />
      </button>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: collapsed ? "0" : "14px",
            marginBottom: "34px",
          }}
        >
          <div className={styles.sidebarStyle2}>
            <ShieldAlert size={22} />
          </div>

          {!collapsed && (
            <div>
              <div className={styles.sidebarStyle3}>AstanaSafe</div>
              <div className={styles.sidebarStyle4}>
                {t("sidebar.subtitle")}
              </div>
            </div>
          )}
        </div>

        <div className={styles.sidebarStyle5}>
          {visibleNavGroups.map((group) => (
            <div key={group.key} className={styles.navGroup}>
              {!collapsed && (
                <div className={styles.navGroupTitle}>{group.label}</div>
              )}

              <div className={styles.navGroupItems}>
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : ""}
                      style={({ isActive }) => ({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: collapsed ? "center" : "flex-start",
                        gap: collapsed ? "0" : "14px",
                        padding: collapsed ? "15px 0" : "13px 16px",
                        borderRadius: "14px",
                        textDecoration: "none",
                        fontWeight: 800,
                        fontSize: "14px",
                        color: isActive ? "#ffffff" : "var(--text-muted)",
                        background: isActive
                          ? "linear-gradient(135deg, var(--primary), var(--accent))"
                          : "transparent",
                        boxShadow: isActive
                          ? "0 14px 28px rgba(37,99,235,0.22)"
                          : "none",
                        transition: "0.2s ease",
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={20}
                            color={isActive ? "#ffffff" : "var(--text-muted)"}
                          />
                          {!collapsed && <span>{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {collapsed ? (
        <div className={styles.sidebarStyle6}>
          {isAuthenticated ? (
            <NavLink
              to="/account"
              title={userName}
              className={styles.sidebarStyle7}
            >
              <User size={18} />
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={handleBottomCardClick}
              title={t("sidebar.signInSignUp")}
              className={styles.sidebarStyle8}
            >
              <LogIn size={18} />
            </button>
          )}
        </div>
      ) : isAuthenticated ? (
        <NavLink to="/account" className={styles.sidebarStyle9}>
          <div className={styles.sidebarStyle10}>
            <div className={styles.sidebarStyle11}>
              <div className={styles.sidebarStyle12}>{userName}</div>
              <div className={styles.sidebarStyle13}>
                {roleLabels[currentRole] || t("sidebar.authenticated")}
              </div>
            </div>

            <div className={styles.sidebarStyle14}>
              <LogIn size={16} />
            </div>
          </div>
        </NavLink>
      ) : (
        <button
          type="button"
          onClick={handleBottomCardClick}
          className={styles.sidebarStyle15}
        >
          <div className={styles.sidebarStyle16}>
            <div className={styles.sidebarStyle17}>
              <div className={styles.sidebarStyle18}>
                {t("sidebar.guestUser")}
              </div>
              <div className={styles.sidebarStyle19}>
                {t("sidebar.signInSignUp")}
              </div>
            </div>

            <div className={styles.sidebarStyle20}>
              <LogIn size={16} />
            </div>
          </div>
        </button>
      )}
    </aside>
  );
}
