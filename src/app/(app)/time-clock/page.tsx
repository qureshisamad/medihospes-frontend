"use client";

import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { Booking } from "@/lib/types";

interface TimeEntry {
  id: number;
  user_id: number;
  shift_booking_id: number;
  clock_in: string;
  clock_out: string | null;
  created_at: string;
}

export default function TimeClockPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, eRes] = await Promise.all([
        api.get("/shifts/my-bookings"),
        api.get("/time/my-entries"),
      ]);
      setBookings(bRes.data);
      setEntries(eRes.data);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeEntry = entries.find((e) => !e.clock_out);

  // Today's confirmed bookings that haven't been clocked in yet
  const todayBookings = bookings.filter((b) => {
    if (b.status !== "confirmed" || !b.shift) return false;
    const shiftDate = new Date(b.shift.start_time).toDateString();
    const today = new Date().toDateString();
    const alreadyClockedIn = entries.some(
      (e) => e.shift_booking_id === b.id
    );
    return shiftDate === today && !alreadyClockedIn;
  });

  const handleClockIn = async (bookingId: number) => {
    try {
      await api.post("/time/clock-in", { shift_booking_id: bookingId });
      toast.success("Clocked in!");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Clock-in failed");
    }
  };

  const handleClockOut = async (entryId: number) => {
    try {
      await api.post("/time/clock-out", { time_entry_id: entryId });
      toast.success("Clocked out!");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Clock-out failed");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Time Clock</h1>
        <p className="mt-1 text-neutral-500">Clock in and out of your shifts</p>
      </div>

      {/* Active clock-in */}
      {activeEntry && (
        <Card className="border-success-500 bg-success-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-success-700">
                Currently clocked in
              </p>
              <p className="text-xs text-success-700 mt-1">
                Since{" "}
                {new Date(activeEntry.clock_in).toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => handleClockOut(activeEntry.id)}
            >
              <LogOut size={18} />
              Clock Out
            </Button>
          </div>
        </Card>
      )}

      {/* Today's shifts to clock into */}
      {!activeEntry && todayBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">
            Today&apos;s Shifts
          </h2>
          <div className="space-y-3">
            {todayBookings.map((b) => (
              <Card
                key={b.id}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <Badge shiftType={b.shift!.shift_type}>
                    {b.shift!.shift_type}
                  </Badge>
                  <p className="mt-1 text-sm text-neutral-700">
                    {new Date(b.shift!.start_time).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(b.shift!.end_time).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button onClick={() => handleClockIn(b.id)}>
                  <LogIn size={18} />
                  Clock In
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!activeEntry && todayBookings.length === 0 && !loading && (
        <Card>
          <p className="text-center text-neutral-500 py-8">
            No shifts to clock into today.
          </p>
        </Card>
      )}

      {/* Recent time entries */}
      {entries.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">
            Recent Entries
          </h2>
          <div className="space-y-2">
            {entries.slice(0, 10).map((entry) => (
              <Card key={entry.id} padding="sm">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-neutral-500" />
                    <span className="text-neutral-700">
                      {new Date(entry.clock_in).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                  <div className="text-neutral-500">
                    {new Date(entry.clock_in).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {entry.clock_out
                      ? new Date(entry.clock_out).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "In progress"}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
