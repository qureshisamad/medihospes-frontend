"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Clock,
  LayoutDashboard,
  LogOut,
  MapPin,
  Briefcase,
  Repeat,
  UserCog,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roster", label: "Roster", icon: CalendarDays },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/admin/rotations", label: "Rotations", icon: Repeat },
  { href: "/admin/shift-types", label: "Shift Types", icon: Clock },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/sites", label: "Sites", icon: MapPin },
  { href: "/admin/job-titles", label: "Job Titles", icon: Briefcase },
  { href: "/admin/users", label: "Accounts", icon: UserCog },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-neutral-200 lg:bg-white lg:min-h-screen lg:fixed lg:left-0 lg:top-0">
      <div className="p-6 border-b border-neutral-200">
        <h1 className="text-lg font-bold text-primary-600">Medihospes</h1>
        <p className="text-xs text-neutral-500 mt-1">Roster Manager</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(link.href + "/");
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
      </nav>

      <div className="p-4 border-t border-neutral-200">
        <div className="text-sm font-medium text-neutral-900 truncate">
          {user?.first_name} {user?.last_name}
        </div>
        <div className="text-xs text-neutral-500 uppercase">{user?.role}</div>
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-2 text-sm text-neutral-500 hover:text-danger-500 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
