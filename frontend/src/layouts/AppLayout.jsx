import { useState } from "react";

import Sidebar from "../components/UI/Sidebar";

export default function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className="app-shell"
      data-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      <main className="app-main">{children}</main>
    </div>
  );
}
