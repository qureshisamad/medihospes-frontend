"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Booking, Shift } from "@/lib/types";

function StaffDashboard() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/shifts/my-bookings")
      .then((res) => setBookings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcoming = bookings
    .filter(
      (b) =>
        b.status === "confirmed" &&
        b.shift &&
        new Date(b.shift.start_time) > new Date()
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Welcome, {user?.first_name}
        </h1>
        <p className="mt-1 text-neutral-500">
          Here&apos;s your schedule overview
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            This Week
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {bookings.filter((b) => b.status === "confirmed").length}
          </p>
          <p className="text-sm text-neutral-500">booked shifts</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Contract
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {user?.weekly_hour_limit}h
          </p>
          <p className="text-sm text-neutral-500">weekly limit</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Role
          </p>
          <p className="mt-2 text-lg font-bold text-neutral-900 capitalize">
            {user?.job_title}
          </p>
          <p className="text-sm text-neutral-500 capitalize">
            {user?.contract_type?.replace("_", " ")}
          </p>
        </Card>
      </div>

      {/* Upcoming shifts */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Upcoming Shifts
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-neutral-100 animate-pulse"
              />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <Card>
            <p className="text-center text-neutral-500 py-6">
              No upcoming shifts. Browse open shifts to claim one.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <Card key={b.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge shiftType={b.shift!.shift_type}>
                      {b.shift!.shift_type}
                    </Badge>
                    <span className="text-sm font-medium text-neutral-900">
                      {new Date(b.shift!.start_time).toLocaleDateString(
                        "it-IT",
                        {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        }
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {new Date(b.shift!.start_time).toLocaleTimeString(
                        "it-IT",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                      {" – "}
                      {new Date(b.shift!.end_time).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {b.shift!.clinic_name && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {b.shift!.clinic_name}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { user } = useAuthStore();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/shifts/")
      .then((res) => setShifts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcomingShifts = shifts.filter(
    (s) => new Date(s.start_time) > now
  );
  const todayShifts = shifts.filter((s) => {
    const start = new Date(s.start_time);
    return (
      start.toDateString() === now.toDateString()
    );
  });
  const totalBookings = shifts.reduce(
    (sum, s) => sum + s.current_bookings,
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Welcome, {user?.first_name}
        </h1>
        <p className="mt-1 text-neutral-500">
          Here&apos;s your management overview
        </p>
      </div>

      {/* Admin stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Total Shifts
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {shifts.length}
          </p>
          <p className="text-sm text-neutral-500">all shifts</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Today
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {todayShifts.length}
          </p>
          <p className="text-sm text-neutral-500">shifts today</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Upcoming
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {upcomingShifts.length}
          </p>
          <p className="text-sm text-neutral-500">scheduled</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Bookings
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {totalBookings}
          </p>
          <p className="text-sm text-neutral-500">total staff booked</p>
        </Card>
      </div>

      {/* Today's shifts */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Today&apos;s Shifts
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-neutral-100 animate-pulse"
              />
            ))}
          </div>
        ) : todayShifts.length === 0 ? (
          <Card>
            <p className="text-center text-neutral-500 py-6">
              No shifts scheduled for today.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayShifts.map((s) => (
              <Card key={s.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge shiftType={s.shift_type}>{s.shift_type}</Badge>
                    {s.clinic_name && (
                      <span className="text-sm font-medium text-neutral-900">
                        {s.clinic_name}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {new Date(s.start_time).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(s.end_time).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {s.current_bookings}/{s.max_capacity} booked
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/admin/shifts">
            <Card className="hover:border-primary-500 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-primary-500" />
                <span className="text-sm font-medium text-neutral-900">
                  Manage Shifts
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/admin/clinics">
            <Card className="hover:border-primary-500 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-primary-500" />
                <span className="text-sm font-medium text-neutral-900">
                  Manage Clinics
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/admin/reports">
            <Card className="hover:border-primary-500 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-primary-500" />
                <span className="text-sm font-medium text-neutral-900">
                  View Reports
                </span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  return isAdmin ? <AdminDashboard /> : <StaffDashboard />;
}
