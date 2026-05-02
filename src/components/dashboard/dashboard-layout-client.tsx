"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  Sidebar,
} from "@/components/dashboard/Sidebar";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";

type DashboardLayoutClientProps = {
  children: React.ReactNode;
  userName: string;
  splitCode: string;
  openComplaintsCount?: number;
};

export function DashboardLayoutClient({
  children,
  userName,
  splitCode,
  openComplaintsCount = 0,
}: DashboardLayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved !== null) setCollapsed(saved === "true");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed, ready]);

  useEffect(() => {
    const mq = () => setIsMobile(window.innerWidth < 768);
    mq();
    window.addEventListener("resize", mq);
    return () => window.removeEventListener("resize", mq);
  }, []);

  const sidebarWidth = isMobile ? 0 : collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Sidebar
        userName={userName}
        splitCode={splitCode}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        isMobile={isMobile}
        openComplaintsCount={openComplaintsCount}
      />

      <motion.div
        initial={false}
        animate={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen pb-[72px] md:pb-0"
      >
        <main className="min-h-[calc(100vh-72px)] p-6 pt-2 md:min-h-screen md:p-8">
          <DashboardTopbar />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
}
