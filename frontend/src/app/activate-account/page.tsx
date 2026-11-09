
"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ActivateAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This invitation link is missing its token.");
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError("Password must be between 12 and 128 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

      const response = await fetch(
        `${API_URL}/api/auth/activate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Unable to activate your account.");
      }

      router.replace("/login?activated=1");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#cbd5e1] bg-white px-4 py-3 pr-16 text-base text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#64748b] focus:ring-2 focus:ring-[#64748b]/20";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[620px] space-y-6 rounded-2xl border border-[#e2e8f0] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-9"
      >
        <header className="space-y-4 text-center">
          <div className="flex justify-center">
            <Image
              src="/geni5-logo.png"
              alt="Geni5"
              width={160}
              height={60}
              priority
              className="h-auto w-32 object-contain sm:w-36"
            />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#080b16]">
            Activate your account
          </h1>

          <p className="text-base text-[#64748b] sm:text-lg">
            Create a password to get started with Geni5 CRM.
          </p>
        </header>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-base font-medium text-[#263449]"
          >
            New password
          </label>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a new password"
              className={inputClass}
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-4 text-sm font-medium text-[#64748b] hover:text-[#111827]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <p className="text-sm text-[#64748b]">
            Use between 12 and 128 characters.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="block text-base font-medium text-[#263449]"
          >
            Confirm new password
          </label>

          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
              className={inputClass}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute inset-y-0 right-4 text-sm font-medium text-[#64748b] hover:text-[#111827]"
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !token}
          className="w-full rounded-xl bg-[#111629] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#202943] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Activating account..." : "Activate account"}
        </button>

        <p className="pt-1 text-center text-base text-[#64748b]">
          Already activated?{" "}
          <a
            href="/login"
            className="font-medium text-[#111827] hover:underline"
          >
            Sign in
          </a>
        </p>
      </form>
    </main>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
          Loading...
        </main>
      }
    >
      <ActivateAccountForm />
    </Suspense>
  );
}
