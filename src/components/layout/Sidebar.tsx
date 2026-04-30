"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Calendar,
  Clock,
  LayoutDashboard,
  LogOut,
  MapPin,
  FileBarChart,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import NotificationBadge from "./NotificationBadge";

const staffLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shifts", label: "Open Shifts", icon: Calendar },
  { href: "/my-shifts", label: "My Shifts", icon: Clock },
  { href: "/time-clock", label: "Time Clock", icon: Clock },
];

const adminLinks = [
  { href: "/admin/shifts", label: "Manage Shifts", icon: Calendar },
  { href: "/admin/clinics", label: "Clinics", icon: MapPin },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const links = isAdmin ? [...staffLinks, ...adminLinks] : staffLinks;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-neutral-200 lg:bg-white lg:min-h-screen lg:fixed lg:left-0 lg:top-0">
        <div className="p-6 border-b border-neutral-200">
          <h1 className="text-lg font-bold text-primary-600">Medihospes</h1>
          <p className="text-xs text-neutral-500 mt-1">Scheduling Platform</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-primary-50 text-primary-600"
                    : "text-neutral-700 hover:bg-neutral-100")
                }
              >
                <link.icon size={20} />
                {link.label}
              </Link>
            );
          })}

          {/* Notification bell */}
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700">
            <Bell size={20} />
            <span>Notifications</span>
            <NotificationBadge />
          </div>
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="text-sm font-medium text-neutral-900 truncate">
            {user?.first_name} {user?.last_name}
          </div>
          <div className="text-xs text-neutral-500 capitalize">{user?.job_title}</div>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-sm text-neutral-500 hover:text-danger-500 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 safe-area-bottom">
        <div className="flex justify-around py-2">
          {links.slice(0, 4).map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs " +
                  (active ? "text-primary-600" : "text-neutral-500")
                }
              >
                <link.icon size={22} />
                {link.label}
              </Link>
            );
          })}

          {/* Notification bell for mobile */}
          <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs text-neutral-500 relative">
            <div className="relative">
              <Bell size={22} />
              <span className="absolute -top-1 -right-2">
                <NotificationBadge />
              </span>
            </div>
            <span>Alerts</span>
          </div>
        </div>
      </nav>
    </>
  );
}
