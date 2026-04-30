"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { Booking } from "@/lib/types";

export default function MyShiftsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = () => {
    setLoading(true);
    api
      .get("/shifts/my-bookings")
      .then((res) => setBookings(res.data))
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (bookingId: number) => {
    try {
      await api.delete(`/shifts/${bookingId}/cancel`);
      toast.success("Booking cancelled");
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not cancel");
    }
  };

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Shifts</h1>
        <p className="mt-1 text-neutral-500">Your booked and past shifts</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      ) : confirmed.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-8">
            You have no booked shifts yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {confirmed.map((b) => (
            <Card
              key={b.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                {b.shift && (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge shiftType={b.shift.shift_type}>
                        {b.shift.shift_type}
                      </Badge>
                      <Badge variant="success">Confirmed</Badge>
                      <span className="text-sm font-medium text-neutral-900">
                        {new Date(b.shift.start_time).toLocaleDateString(
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
                        {new Date(b.shift.start_time).toLocaleTimeString(
                          "it-IT",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                        {" – "}
                        {new Date(b.shift.end_time).toLocaleTimeString(
                          "it-IT",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                      {b.shift.clinic_name && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {b.shift.clinic_name}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              {b.shift &&
                new Date(b.shift.start_time) > new Date() && (
                  <Button
                    variant="ghost"
                    onClick={() => handleCancel(b.id)}
                    className="shrink-0 text-danger-500"
                  >
                    <X size={16} />
                    Cancel
                  </Button>
                )}
            </Card>
          ))}
        </div>
      )}

      {cancelled.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-500 mb-3">
            Cancelled
          </h2>
          <div className="space-y-2 opacity-60">
            {cancelled.map((b) => (
              <Card key={b.id} padding="sm">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Badge variant="danger">Cancelled</Badge>
                  {b.shift && (
                    <span>
                      {new Date(b.shift.start_time).toLocaleDateString("it-IT")}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
