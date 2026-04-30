"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/store";
import Sidebar from "./Sidebar";

// Load Toaster only on the client to avoid hydration mismatch from portals
const Toaster = dynamic(
  () => import("react-hot-toast").then((mod) => mod.Toaster),
  { ssr: false }
);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, hydrate } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  useEffect(() => {
    if (mounted && !user) {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
      }
    }
  }, [mounted, user, router]);

  // Render a consistent shell on both server and client to avoid hydration mismatch.
  // The loading state only shows after mount confirms there's no user.
  if (!mounted || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "14px",
          },
        }}
      />
      <Sidebar />
      <main className="lg:ml-64 pb-20 lg:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
