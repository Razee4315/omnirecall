import { useState } from "preact/hooks";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { DocumentDrawer } from "./DocumentDrawer";

export function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);

  return (
    <div className="h-full w-full flex">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <ChatArea />
      <DocumentDrawer
        collapsed={drawerCollapsed}
        onToggle={() => setDrawerCollapsed(!drawerCollapsed)}
      />
    </div>
  );
}
