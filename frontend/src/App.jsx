import { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";

import AppRoutes from "./app/AppRoutes";
import AuthRequired from "./components/UI/AuthRequired";
import AuthModal from "./components/UI/AuthModal";
import SosEmergencyModal from "./components/UI/SosEmergencyModal";
import TrafficJamModal from "./components/UI/TrafficJamModal";
import { SosCallProvider } from "./features/sosCall/SosCallProvider";
import AppLayout from "./layouts/AppLayout";
import { useAppStore } from "./store/useAppStore";

function AppContent() {
  const location = useLocation();
  const language = useAppStore((state) => state.language);
  const currentUser = useAppStore((state) => state.currentUser);
  const authModalOpen = useAppStore((state) => state.authModalOpen);
  const openAuthModal = useAppStore((state) => state.openAuthModal);
  const closeAuthModal = useAppStore((state) => state.closeAuthModal);
  const trafficJamModalOpen = useAppStore((state) => state.trafficJamModalOpen);
  const trafficJamSelectedPoint = useAppStore(
    (state) => state.trafficJamSelectedPoint
  );
  const closeTrafficJamModal = useAppStore(
    (state) => state.closeTrafficJamModal
  );
  const sosModalOpen = useAppStore((state) => state.sosModalOpen);
  const closeSosModal = useAppStore((state) => state.closeSosModal);
  const signOut = useAppStore((state) => state.signOut);
  const hasAuthToken = !!localStorage.getItem("token");
  const isAuthenticated = !!currentUser && hasAuthToken;

  useEffect(() => {
    document.documentElement.lang = language === "kz" ? "kk" : language;
  }, [language]);

  useEffect(() => {
    window.addEventListener("astanasafe-auth-expired", signOut);

    return () => {
      window.removeEventListener("astanasafe-auth-expired", signOut);
    };
  }, [signOut]);

  const isPasswordResetRoute = location.pathname === "/reset-password";
  const canUseApp = isAuthenticated || isPasswordResetRoute;

  return (
    <SosCallProvider
      enabled={isAuthenticated}
      key={isAuthenticated ? currentUser?.id || "user" : "guest"}
    >
      {canUseApp ? (
        isPasswordResetRoute ? (
          <AppRoutes />
        ) : (
          <AppLayout>
            <AppRoutes />
          </AppLayout>
        )
      ) : (
        <AuthRequired onSignIn={openAuthModal} />
      )}

      <AuthModal open={authModalOpen} onClose={closeAuthModal} />

      {isAuthenticated ? (
        <>
          <TrafficJamModal
            open={trafficJamModalOpen}
            onClose={closeTrafficJamModal}
            selectedPoint={trafficJamSelectedPoint}
          />

          <SosEmergencyModal open={sosModalOpen} onClose={closeSosModal} />
        </>
      ) : null}
    </SosCallProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
