"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const Toaster = dynamic(
  () => import("react-hot-toast").then((mod) => mod.Toaster),
  { ssr: false }
);

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-primary-600">Medihospes</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Sign in to your scheduling account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            placeholder="you@medihospes.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
