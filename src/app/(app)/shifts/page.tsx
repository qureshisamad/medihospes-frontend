"use client";

import CalendarView from "@/components/calendar/CalendarView";

export default function OpenShiftsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Open Shifts</h1>
        <p className="mt-1 text-neutral-500">
          Available shifts matching your role
        </p>
      </div>

      <CalendarView isAdmin={false} />
    </div>
  );
}
