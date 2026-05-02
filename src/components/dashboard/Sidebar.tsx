"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SIDEBAR_EXPANDED_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export type SidebarNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

export const sidebarNavItems: SidebarNavItem[] = [
  { label: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Projects", icon: FolderKanban, href: "/dashboard/projects" },
  { label: "Escrow Milestones", icon: ShieldCheck, href: "/dashboard/milestones" },
  { label: "SplitPay API", icon: Zap, href: "/dashboard/api" },
  { label: "Virtual Card", icon: CreditCard, href: "/dashboard/virtual-card" },
  { label: "Transactions", icon: ArrowLeftRight, href: "/dashboard/transactions" },
  { label: "Notifications", icon: Bell, href: "/dashboard/notifications" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
  { label: "Complaints", icon: AlertTriangle, href: "/dashboard/complaints" },
];

const mobileTabItems = sidebarNavItems.slice(0, 5);

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarProps = {
  userName: string;
  splitCode: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobile: boolean;
  openComplaintsCount?: number;
};

export function Sidebar({
  userName,
  splitCode,
  collapsed,
  onToggleCollapsed,
  isMobile,
  openComplaintsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  const renderNavLink = (item: SidebarNavItem) => {
    const Icon = item.icon;
    const active = isNavActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-md py-2.5 pl-3 pr-2 text-sm transition-colors duration-150",
          active
            ? "border-l-[3px] border-l-orange-500 bg-bg-card text-text-primary"
            : "border-l-[3px] border-l-transparent text-text-muted hover:bg-bg-card/50 hover:text-text-primary",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {!collapsed && item.href === "/dashboard/complaints" && openComplaintsCount > 0 ? (
          <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {openComplaintsCount > 9 ? "9+" : openComplaintsCount}
          </span>
        ) : null}
      </Link>
    );
  };

  if (isMobile) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-bg-surface/95 px-1 py-2 backdrop-blur md:hidden"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5 gap-0.5">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md py-1.5 text-[10px] transition-colors",
                  active ? "text-orange-500" : "text-text-muted",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                <span className="max-w-full truncate px-0.5">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-y-0 left-0 z-40 hidden h-screen border-r border-border-subtle bg-bg-surface md:flex md:flex-col"
    >
      <div className={cn("flex h-[52px] shrink-0 items-center justify-between px-3", collapsed && "px-2")}>
        <Link
          href="/dashboard"
          className={cn(
            "font-display text-[20px] font-bold leading-none tracking-tight",
            collapsed && "pointer-events-none w-0 overflow-hidden opacity-0",
          )}
        >
          <span className="text-white">Split</span>
          <span className="text-orange-500">Pay</span>
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="shrink-0 rounded-md border border-border-strong bg-bg-card p-1.5 text-text-muted transition-colors hover:text-text-primary"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn("border-b border-border-subtle px-3 py-3", collapsed && "px-2")}>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="mt-0.5 font-mono text-xs text-orange-500">#{splitCode}</p>
          </div>
        ) : (
          <div className="flex justify-center" title={`${userName} · #${splitCode}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-black">
              {userName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase() || "?"}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">{sidebarNavItems.map(renderNavLink)}</nav>

      <div className="shrink-0 border-t border-border-subtle p-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md py-2.5 pl-3 pr-2 text-sm text-text-muted transition-all hover:bg-bg-card/50 hover:text-text-primary",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}
