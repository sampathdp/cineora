"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AuthCard, Field, FormMessage, applyApiError } from "./form-kit";

const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  if (sent) {
    return (
      <AuthCard title="Check your inbox">
        <p role="status" className="text-muted">
          If an account exists for that email, a reset link has been sent. It expires in 60 minutes.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="Enter your email and we will send a reset link.">
      <form
        noValidate
        aria-label="Request password reset"
        className="flex flex-col gap-5"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          try {
            await authApi.forgotPassword(v.email);
            setSent(true);
          } catch (e) {
            setFormError(applyApiError(e, setError, ["email"]));
          }
        })}
      >
        <FormMessage>{formError}</FormMessage>
        <Field label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}

const resetSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number."),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  if (!token || !email) {
    return (
      <AuthCard title="Link problem">
        <p className="text-muted">This reset link is incomplete. Request a new one.</p>
        <Link href="/forgot-password" className="mt-4 inline-block font-semibold text-accent-text hover:underline">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div role="status" className="flex flex-col gap-3">
          <CheckCircle2 className="size-8 text-accent-text" aria-hidden />
          <p className="text-muted">Your password has been reset and other devices were signed out.</p>
          <Link href="/login" className="font-semibold text-accent-text hover:underline">
            Sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle={email}>
      <form
        noValidate
        aria-label="Reset password"
        className="flex flex-col gap-5"
        onSubmit={handleSubmit(async (v) => {
          setFormError(null);
          try {
            await authApi.resetPassword({ token, email, ...v });
            setDone(true);
          } catch (e) {
            // The server reports an invalid/expired token against "email".
            const tokenProblem = e instanceof ApiError ? e.fieldError("email") : undefined;
            setFormError(tokenProblem ?? applyApiError(e, setError, ["password", "password_confirmation"]));
          }
        })}
      >
        <FormMessage>{formError}</FormMessage>
        <Field label="New password" type="password" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" {...register("password_confirmation")} error={errors.password_confirmation?.message} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </AuthCard>
  );
}
