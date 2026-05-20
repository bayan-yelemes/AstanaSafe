import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Analytics = lazy(() => import("../pages/Analytics"));
const Reports = lazy(() => import("../pages/Reports"));
const Forecast = lazy(() => import("../pages/Forecast"));
const Dispatcher = lazy(() => import("../pages/Dispatcher"));
const MySos = lazy(() => import("../pages/MySos"));
const DangerZones = lazy(() => import("../pages/DangerZones"));
const DistrictPassport = lazy(() => import("../pages/DistrictPassport"));
const ResponseScenarios = lazy(() => import("../pages/ResponseScenarios"));
const RoadVision = lazy(() => import("../pages/RoadVision"));
const Admin = lazy(() => import("../pages/Admin"));
const Account = lazy(() => import("../pages/Account"));
const Settings = lazy(() => import("../pages/Settings"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const NotFound = lazy(() => import("../pages/NotFound"));

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/dispatcher" element={<Dispatcher />} />
        <Route path="/my-sos" element={<MySos />} />
        <Route path="/danger-zones" element={<DangerZones />} />
        <Route path="/district-passport" element={<DistrictPassport />} />
        <Route path="/response-scenarios" element={<ResponseScenarios />} />
        <Route path="/roadvision" element={<RoadVision />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
