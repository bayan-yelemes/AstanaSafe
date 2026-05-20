import { create } from "zustand";
import { persist } from "zustand/middleware";

import { getForecast, getDashboardInsight } from "../services/aiService";
import { getRealAccidents } from "../services/accidentsService";
import {
  createSosIncident,
  getSosIncidents,
  updateSosIncidentStatus,
} from "../services/sosService";
import {
  createTrafficReport,
  deleteTrafficReport,
  getTrafficReports,
} from "../services/trafficReportsService";
import { getCurrentWeather } from "../services/weatherService";
import { getIntersections, getStreets } from "../services/roadsService";
import {
  changeMyPassword,
  getCurrentUser,
  updateMyProfile,
} from "../services/authService";
import { formatDateForApi } from "../utils/date";
import { reportError } from "../utils/logger";
import {
  clearStoredUser,
  getStoredUser,
  normalizeStoredUser,
  persistCurrentUser,
  updateStoredUsers,
} from "../utils/storage";

const INITIAL_FILTERS = {
  district: "all",
  type: "all",
  weather: "all",
};

const INITIAL_WEATHER = {
  temperature: null,
  condition: "Loading...",
  city: "Astana",
};

const INITIAL_AI_INSIGHT = {
  insight: "Loading AI insight...",
  summary: null,
};

function matchesSelectedDate(item, selectedDate) {
  if (!selectedDate || !item.date) return true;

  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) return false;

  return formatDateForApi(date) === formatDateForApi(selectedDate);
}

function filterAccidents(accidents, filters, selectedDate) {
  return accidents.filter((item) => {
    if (!matchesSelectedDate(item, selectedDate)) return false;

    if (
      filters.type !== "all" &&
      item.type !== String(filters.type).toLowerCase()
    ) {
      return false;
    }

    if (filters.district !== "all") {
      const districtName =
        item.district?.name || item.district_name || item.district || "";

      if (districtName !== filters.district) return false;
    }

    return true;
  });
}

function buildAccidentQueryParams(filters) {
  const params = {
    limit: 5000,
  };

  if (filters.weather !== "all") {
    params.weather = String(filters.weather).toLowerCase();
  }

  if (filters.type !== "all") {
    const typeValue = String(filters.type).toLowerCase();
    if (["collision", "pedestrian", "rollover"].includes(typeValue)) {
      params.type = typeValue;
    }
  }

  return params;
}

function buildHeatmapPoints(accidents, selectedDate) {
  return accidents
    .filter((item) => matchesSelectedDate(item, selectedDate))
    .map((item) => ({
      lat: item.latitude,
      lng: item.longitude,
      weight: item.severity === "high" ? 3 : item.severity === "medium" ? 2 : 1,
    }));
}

function updateReportAuthor(report, currentUser, updatedUser) {
  const currentUserId =
    currentUser?.id || currentUser?.email || currentUser?.phone;

  if (report.userId !== currentUserId) return report;

  return {
    ...report,
    userName: updatedUser.full_name || updatedUser.name || report.userName,
    userEmail: updatedUser.email || report.userEmail,
    userPhone: updatedUser.phone || report.userPhone,
  };
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      accidents: [],
      heatmapPoints: [],
      trafficReports: [],
      sosIncidents: [],
      sosModalOpen: false,
      language: localStorage.getItem("astanasafe_language") || "ru",
      filters: INITIAL_FILTERS,
      selectedDate: new Date(),
      weather: INITIAL_WEATHER,
      aiInsight: INITIAL_AI_INSIGHT,
      streets: [],
      intersections: [],
      roadsLoading: false,
      roadsError: "",
      currentUser: getStoredUser(),
      authModalOpen: false,
      focusedReportPoint: null,
      trafficJamModalOpen: false,
      trafficJamSelectedPoint: null,

      setLanguage: (language) => {
        localStorage.setItem("astanasafe_language", language);
        set({ language });
      },

      openAuthModal: () => set({ authModalOpen: true }),
      closeAuthModal: () => set({ authModalOpen: false }),

      openSosModal: () => set({ sosModalOpen: true }),
      closeSosModal: () => set({ sosModalOpen: false }),

      openTrafficJamModal: (point = null) =>
        set({
          trafficJamModalOpen: true,
          trafficJamSelectedPoint: point,
        }),

      closeTrafficJamModal: () =>
        set({
          trafficJamModalOpen: false,
          trafficJamSelectedPoint: null,
        }),

      setSelectedDate: (date) => set({ selectedDate: date }),

      setFocusedReportPoint: (point) => set({ focusedReportPoint: point }),
      clearFocusedReportPoint: () => set({ focusedReportPoint: null }),

      setCurrentUser: (user) => {
        const normalizedUser = normalizeStoredUser(user);
        persistCurrentUser(normalizedUser);
        set({ currentUser: normalizedUser });
      },

      loadCurrentUser: () => {
        set({ currentUser: getStoredUser() });
      },

      refreshCurrentUser: async () => {
        const token = localStorage.getItem("token");
        if (!token) return { ok: false, skipped: true };

        try {
          const user = await getCurrentUser();
          const normalizedUser = normalizeStoredUser(user);
          persistCurrentUser(normalizedUser);
          set({ currentUser: normalizedUser });

          return {
            ok: true,
            user: normalizedUser,
          };
        } catch (error) {
          reportError("Error refreshing current user:", error);

          return {
            ok: false,
            message: error?.response?.data?.detail || "Failed to refresh user.",
          };
        }
      },

      signOut: () => {
        clearStoredUser();
        set({ currentUser: null });
      },

      updateCurrentUser: (updates) =>
        set((state) => {
          const updatedUser = normalizeStoredUser({
            ...state.currentUser,
            ...updates,
          });

          persistCurrentUser(updatedUser);
          updateStoredUsers(state.currentUser, updates);

          return {
            currentUser: updatedUser,
            trafficReports: state.trafficReports.map((report) =>
              updateReportAuthor(report, state.currentUser, updatedUser),
            ),
          };
        }),

      saveCurrentUserProfile: async (updates) => {
        try {
          const updatedUser = await updateMyProfile(updates);
          get().updateCurrentUser(updatedUser);

          return {
            ok: true,
            user: updatedUser,
          };
        } catch (error) {
          reportError("Error updating current user profile:", error);

          return {
            ok: false,
            message: error?.response?.data?.detail || "Profile update failed.",
            messageKey:
              error?.response?.data?.detail === "Provide email or phone"
                ? "account.contactRequired"
                : null,
          };
        }
      },

      changePassword: async ({
        currentPassword,
        newPassword,
        confirmPassword,
      }) => {
        const currentUser = get().currentUser;

        if (!currentUser) {
          return {
            ok: false,
            message: "User not found.",
            messageKey: "auth.wrongCredentials",
          };
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
          return {
            ok: false,
            message: "Please fill in all password fields.",
            messageKey: "auth.fillRequired",
          };
        }

        if (newPassword.length < 6) {
          return {
            ok: false,
            message: "New password must be at least 6 characters.",
            messageKey: "resetPasswordPage.minLength",
          };
        }

        if (newPassword !== confirmPassword) {
          return {
            ok: false,
            message: "New passwords do not match.",
            messageKey: "resetPasswordPage.mismatch",
          };
        }

        try {
          await changeMyPassword({ currentPassword, newPassword });

          return {
            ok: true,
            message: "Password updated successfully.",
          };
        } catch (error) {
          reportError("Error changing password:", error);
          const detail = error?.response?.data?.detail;

          return {
            ok: false,
            message: detail || "Password update failed.",
            messageKey:
              detail === "Current password is incorrect"
                ? "account.currentPasswordIncorrect"
                : detail === "Password changes are unavailable for this account"
                  ? "account.passwordChangeUnavailable"
                  : null,
          };
        }
      },

      setFilter: (key, value) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [key]: value,
          },
        })),

      fetchTrafficReports: async () => {
        try {
          const reports = await getTrafficReports(get().selectedDate);
          set({ trafficReports: reports });
        } catch (error) {
          reportError("Error fetching traffic reports:", error);
        }
      },

      addTrafficReport: async (report) => {
        try {
          const savedReport = await createTrafficReport(
            report,
            get().currentUser || getStoredUser(),
            get().selectedDate,
          );

          set((state) => ({
            trafficReports: [savedReport, ...state.trafficReports],
          }));

          return {
            ok: true,
            report: savedReport,
          };
        } catch (error) {
          reportError("Error saving traffic report:", error);
          return {
            ok: false,
            message:
              error?.response?.status === 401
                ? ""
                : error?.response?.data?.detail || "",
          };
        }
      },

      removeTrafficReport: async (id) => {
        try {
          await deleteTrafficReport(id);

          set((state) => ({
            trafficReports: state.trafficReports.filter(
              (item) => item.id !== id,
            ),
          }));

          return { ok: true };
        } catch (error) {
          reportError("Error deleting traffic report:", error);
          return { ok: false };
        }
      },

      fetchSosIncidents: async ({ activeOnly = false } = {}) => {
        try {
          const incidents = await getSosIncidents({ activeOnly });
          set({ sosIncidents: incidents });

          return {
            ok: true,
            incidents,
          };
        } catch (error) {
          reportError("Error fetching SOS incidents:", error);
          return { ok: false, incidents: [] };
        }
      },

      createSosIncident: async (incident) => {
        try {
          const savedIncident = await createSosIncident(
            incident,
            get().currentUser || getStoredUser(),
          );

          set((state) => ({
            sosIncidents: [
              savedIncident,
              ...state.sosIncidents.filter(
                (item) => item.id !== savedIncident.id,
              ),
            ],
          }));

          return {
            ok: true,
            incident: savedIncident,
          };
        } catch (error) {
          reportError("Error creating SOS incident:", error);
          return { ok: false, incident: null };
        }
      },

      updateSosIncidentStatus: async (id, status) => {
        try {
          const updatedIncident = await updateSosIncidentStatus(id, status);

          set((state) => ({
            sosIncidents: state.sosIncidents.map((item) =>
              item.id === id ? updatedIncident : item,
            ),
          }));

          return {
            ok: true,
            incident: updatedIncident,
          };
        } catch (error) {
          reportError("Error updating SOS incident:", error);
          return { ok: false, incident: null };
        }
      },

      fetchAccidents: async () => {
        try {
          const { filters, selectedDate } = get();
          const accidents = await getRealAccidents(
            buildAccidentQueryParams(filters),
          );

          set({
            accidents: filterAccidents(accidents, filters, selectedDate),
          });
        } catch (error) {
          reportError("Error fetching real accidents:", error);
          set({ accidents: [] });
        }
      },

      fetchHeatmap: async () => {
        try {
          set({
            heatmapPoints: buildHeatmapPoints(
              get().accidents || [],
              get().selectedDate,
            ),
          });
        } catch (error) {
          reportError("Error building heatmap from real accidents:", error);
          set({ heatmapPoints: [] });
        }
      },

      fetchWeather: async () => {
        try {
          set({ weather: await getCurrentWeather() });
        } catch (error) {
          reportError("Error fetching weather:", error);

          set({
            weather: {
              temperature: null,
              condition: "Unavailable",
              city: "Astana",
            },
          });
        }
      },

      fetchAiInsight: async () => {
        try {
          set({ aiInsight: await getDashboardInsight() });
        } catch (error) {
          reportError("Error fetching AI insight:", error);

          set({
            aiInsight: {
              insight: "AI insight is unavailable right now.",
              summary: null,
            },
          });
        }
      },

      fetchForecast: async ({ styleHint, refreshSeed } = {}) => {
        return getForecast({
          selectedDate: get().selectedDate,
          refreshSeed,
          styleHint,
          language: get().language,
        });
      },

      fetchStreets: async () => {
        try {
          set({ roadsLoading: true, roadsError: "" });

          set({
            streets: await getStreets(),
            roadsLoading: false,
            roadsError: "",
          });
        } catch (error) {
          reportError("Error fetching streets:", error);
          set({
            streets: [],
            roadsLoading: false,
            roadsError: "Failed to load roads",
          });
        }
      },

      fetchIntersections: async (street) => {
        try {
          set({
            roadsLoading: true,
            intersections: [],
            roadsError: "",
          });

          set({
            intersections: await getIntersections(street),
            roadsLoading: false,
            roadsError: "",
          });
        } catch (error) {
          reportError("Failed to fetch intersections:", error);
          set({
            intersections: [],
            roadsLoading: false,
            roadsError: "Failed to load intersections",
          });
        }
      },
    }),
    {
      name: "astanasafe-store",
      partialize: (state) => ({
        currentUser: normalizeStoredUser(state.currentUser),
        language: state.language,
      }),
      merge: (persistedState, currentState) => {
        const state = persistedState || {};

        return {
          ...currentState,
          ...state,
          currentUser: normalizeStoredUser(state.currentUser),
        };
      },
    },
  ),
);
