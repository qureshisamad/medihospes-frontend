"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.user, data.access_token);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {mounted && <Toaster position="top-right" />}

      {/* Left branded panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100 lg:flex lg:flex-col lg:justify-center lg:p-12">
        {/* Decorative geometric shapes */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          preserveAspectRatio="none"
          viewBox="0 0 600 800"
        >
          {/* Top-right: large angled triangle */}
          <polygon
            points="380,0 600,0 600,220"
            fill="none"
            stroke="var(--primary-200)"
            strokeWidth="1.2"
            opacity="0.5"
          />
          <polygon
            points="440,0 600,0 600,160"
            fill="none"
            stroke="var(--primary-200)"
            strokeWidth="0.8"
            opacity="0.35"
          />

          {/* Bottom-right: triangle pointing up */}
          <polygon
            points="400,620 600,620 500,480"
            fill="none"
            stroke="var(--primary-200)"
            strokeWidth="1.2"
            opacity="0.45"
          />
          <polygon
            points="450,620 600,620 525,530"
            fill="none"
            stroke="var(--primary-200)"
            strokeWidth="0.8"
            opacity="0.3"
          />

          {/* Bottom-left: circle + diamond */}
          <circle
            cx="100"
            cy="700"
            r="70"
            fill="none"
            stroke="var(--primary-200)"
            strokeWidth="1.2"
            opacity="0.35"
          />
          <polygon
            points="100,620 170,700 100,780 30,700"
            fill="none"
            stroke="var(--primary-200)"
            strokeWidth="0.8"
            opacity="0.25"
          />
        </svg>

        {/* Brand content */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-primary-600">Medihospes</h2>
          <div className="mt-5 h-1 w-10 rounded-full bg-primary-500" />
          <h3 className="mt-5 text-xl font-semibold text-neutral-900">
            Staff Scheduling Platform
          </h3>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">
            Manage shifts, track hours, and coordinate
            your&nbsp;team&nbsp;&mdash;&nbsp;all from one dashboard.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 lg:w-1/2 lg:px-16">
        <div className="w-full max-w-md">
          {/* Mobile-only brand header */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold text-primary-600">Medihospes</h1>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            WELCOME BACK
          </h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Input
              label="Email address"
              type="email"
              placeholder="you@medihospes.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {/* Password field with show/hide toggle */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-neutral-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={
                    "h-12 w-full rounded-lg border border-neutral-300 px-3 pr-16 text-sm " +
                    "transition-colors placeholder:text-neutral-500 " +
                    "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-primary-500 hover:text-primary-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-neutral-500 hover:text-primary-600"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>

          {/* Collapsible demo credentials */}
          <details className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-700 select-none">
              Demo Credentials
            </summary>
            <div className="border-t border-neutral-200 px-4 py-3 space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Admin</p>
                <p className="text-neutral-700">admin@medihospes.it</p>
                <p className="text-neutral-500">admin123</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Nurse (Staff)</p>
                <p className="text-neutral-700">nurse@medihospes.it</p>
                <p className="text-neutral-500">staff123</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Technician (Staff)</p>
                <p className="text-neutral-700">tech@medihospes.it</p>
                <p className="text-neutral-500">staff123</p>
              </div>
            </div>
          </details>

          <p className="mt-6 text-center text-xs text-neutral-500">
            &copy; 2026 Medihospes. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
