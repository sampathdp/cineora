"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeRedirect } from "@/lib/safe-redirect";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { AuthCard, Field, FormMessage, applyApiError } from "./form-kit";
import { GoogleButton } from "./google-button";
import { VerifyCodeForm } from "./verify-code-form";

// Mirrors the server rules for fast feedback; the server remains the authority.
const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .regex(/^([0-9+\-\s()]{6,32})?$/, "Enter a valid phone number.")
      .optional(),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number."),
    password_confirmation: z.string(),
    terms: z.boolean().refine((v) => v, "Please accept the terms to continue."),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  // Where to land after the customer signs in (e.g. back to the seat map).
  const rawNext = useSearchParams().get("next");
  const loginHref = rawNext ? `/login?next=${encodeURIComponent(safeRedirect(rawNext))}` : "/login";
  const [done, setDone] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { terms: false } });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await authApi.register({ ...values, phone: values.phone || undefined });
      setDone(values.email);
    } catch (e) {
      setFormError(applyApiError(e, setError, ["name", "email", "phone", "password", "terms"]));
    }
  }

  if (verified) {
    return (
      <AuthCard title="Email verified">
        <div role="status" className="flex flex-col gap-3">
          <CheckCircle2 className="size-8 text-accent-text" aria-hidden />
          <p className="text-muted">Your account is ready. Sign in to book tickets.</p>
          <Link href={loginHref} className="font-semibold text-accent-text hover:underline">
            Continue to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Check your inbox">
        <div className="flex flex-col gap-4">
          <MailCheck className="size-8 text-accent-text" aria-hidden />
          <p className="text-muted">
            If <strong className="text-foreground">{done}</strong> can be registered, we have emailed a 6-digit code. It is valid for 10 minutes.
          </p>
          <VerifyCodeForm email={done} onVerified={() => setVerified(true)} />
          <Link href={loginHref} className="text-sm font-semibold text-accent-text hover:underline">
            Already verified? Sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Book seats, pay by bank transfer and keep your tickets in one place."
      footer={
        <>
          Already registered?{" "}
          <Link href={loginHref} className="font-semibold text-accent-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton next={safeRedirect(rawNext)} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5" aria-label="Create account">
        <FormMessage>{formError}</FormMessage>
        <Field label="Full name" autoComplete="name" {...register("name")} error={errors.name?.message} />
        <Field label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
        <Field label="Phone (optional)" type="tel" autoComplete="tel" {...register("phone")} error={errors.phone?.message} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters with upper and lower case letters and a number."
          {...register("password")}
          error={errors.password?.message}
        />
        <Field label="Confirm password" type="password" autoComplete="new-password" {...register("password_confirmation")} error={errors.password_confirmation?.message} />
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" {...register("terms")} />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-semibold text-accent-text hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-accent-text hover:underline">
                privacy notice
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <p role="alert" className="mt-1.5 text-sm text-red-500">
              {errors.terms.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
