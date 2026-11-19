"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { safeRedirect } from "@/lib/safe-redirect";
import { AuthCard, Field, FormMessage, applyApiError } from "./form-kit";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = safeRedirect(useSearchParams().get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace(next);
    } catch (e) {
      setFormError(applyApiError(e, setError, ["email", "password"]));
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Access your bookings and tickets."
      footer={
        <>
          New to Cineora?{" "}
          <Link href="/register" className="font-semibold text-accent-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5" aria-label="Sign in">
        <FormMessage>{formError}</FormMessage>
        <Field label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
        <Field label="Password" type="password" autoComplete="current-password" {...register("password")} error={errors.password?.message} />
        <Link href="/forgot-password" className="-mt-2 text-sm font-semibold text-accent-text hover:underline">
          Forgot your password?
        </Link>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
