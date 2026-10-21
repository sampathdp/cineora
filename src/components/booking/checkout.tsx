"use client";

import { cloneElement, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Landmark, Upload } from "lucide-react";
import { siteConfig } from "@/config/site";
import { confirmDemoBooking, isExpired, useDraft } from "@/lib/booking-store";
import { formatISODate, formatPrice, formatTime } from "@/lib/formatters";
import { CATEGORY_LABEL } from "@/lib/seats";
import { Button } from "@/components/ui/button";
import { BackLink, DemoNotice, Skeleton } from "@/components/ui/misc";
import { MissingBooking, SERVICE_FEE_PER_SEAT, useBookingDetails } from "./booking-context";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s()-]{6,}$/, "Enter a valid phone number (digits, spaces, + or -)."),
  paymentReference: z.string().trim().max(40, "Keep the reference under 40 characters.").optional(),
  agree: z.boolean().refine((v) => v, "Please confirm you understand this is a demonstration."),
});
type FormValues = z.infer<typeof schema>;

export function Checkout() {
  const router = useRouter();
  const draft = useDraft();
  const details = useBookingDetails(draft);
  const [proof, setProof] = useState<{ name: string; url: string | null } | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "", paymentReference: "", agree: false },
  });

  // Revoke object URLs for the local-only proof preview.
  useEffect(() => {
    const url = proof?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [proof]);

  if (draft === undefined) {
    return (
      <div className="container-page pt-32">
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (draft === null || !details || details.seats.length === 0) {
    return (
      <MissingBooking
        title="No booking in progress"
        message="Choose a movie, showtime and seats first. Demo bookings are only kept for this browser session."
      />
    );
  }
  if (isExpired(draft)) {
    return (
      <MissingBooking
        title="Your selection expired"
        message="For this demo, seat selections expire after 30 minutes. Please pick your seats again."
      />
    );
  }

  const { movie, cinema, screen, showtime, seats, subtotal, fee, total } = details;

  function onPickProof(e: React.ChangeEvent<HTMLInputElement>) {
    setProofError(null);
    const file = e.target.files?.[0];
    if (!file) return setProof(null);
    if (file.size > 5 * 1024 * 1024) {
      setProof(null);
      setProofError("File is larger than 5 MB.");
      return;
    }
    // Preview only. The file never leaves this browser tab.
    setProof({ name: file.name, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
  }

  function onSubmit(values: FormValues) {
    if (!draft) return;
    confirmDemoBooking(draft, {
      customer: { fullName: values.fullName, email: values.email, phone: values.phone },
      paymentReference: values.paymentReference ?? "",
      proofFileName: proof?.name,
      total,
    });
    router.push("/booking/confirmation");
  }

  const field =
    "h-12 w-full rounded-control border bg-background px-3 text-base outline-none placeholder:text-muted focus:border-accent";

  return (
    <div className="container-page pb-20 pt-28 sm:pt-32">
      <BackLink href={`/booking/${showtime.id}`}>Change seats</BackLink>
      <p className="eyebrow mt-2">Checkout</p>
      <h1 className="display mt-2 text-4xl sm:text-6xl">Review &amp; pay by bank transfer</h1>
      <DemoNotice className="mt-6">
        This page is a frontend demonstration. No payment is processed, nothing is uploaded and no ticket is issued.
      </DemoNotice>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-8">
          <fieldset className="rounded-card border border-line bg-elevated p-5 sm:p-6">
            <legend className="display px-2 text-2xl">Your details</legend>
            <div className="mt-2 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" error={errors.fullName?.message} className="sm:col-span-2">
                <input {...register("fullName")} autoComplete="name" className={field + (errors.fullName ? " border-red-500" : " border-line")} aria-invalid={!!errors.fullName} />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input {...register("email")} type="email" autoComplete="email" className={field + (errors.email ? " border-red-500" : " border-line")} aria-invalid={!!errors.email} />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <input {...register("phone")} type="tel" autoComplete="tel" className={field + (errors.phone ? " border-red-500" : " border-line")} aria-invalid={!!errors.phone} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="rounded-card border border-line bg-elevated p-5 sm:p-6">
            <legend className="display px-2 text-2xl">Payment method</legend>
            <label className="mt-2 flex items-center gap-3 rounded-control border border-accent bg-accent/10 p-4">
              <input type="radio" name="method" defaultChecked readOnly className="size-4 accent-[var(--accent)]" />
              <Landmark className="size-5 text-accent-text" aria-hidden />
              <span className="font-semibold">Bank transfer</span>
              <span className="ml-auto text-xs text-muted">Only option</span>
            </label>

            <div className="mt-5 rounded-card border border-line bg-surface p-4 text-sm">
              <p className="font-semibold">Demo bank details (fictional)</p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {(
                  [
                    ["Bank", siteConfig.demoBank.bankName],
                    ["Account name", siteConfig.demoBank.accountName],
                    ["Account number", siteConfig.demoBank.accountNumber],
                    ["Branch", siteConfig.demoBank.branch],
                    ["SWIFT/BIC", siteConfig.demoBank.swift],
                    ["Amount", formatPrice(total)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-muted">
                <li>Transfer the total to the account above using your bank&apos;s app. (Demo: do not send real money.)</li>
                <li>Use your booking reference as the transfer description.</li>
                <li>Enter your transfer reference below and optionally attach a proof preview.</li>
                <li>In a real system, staff would verify the transfer manually before issuing tickets.</li>
              </ol>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Payment reference (optional)" error={errors.paymentReference?.message}>
                <input {...register("paymentReference")} placeholder="e.g. TRX-000000" className={field + " border-line"} />
              </Field>
              <div>
                <label htmlFor="proof" className="mb-1.5 block text-sm font-semibold">
                  Proof of transfer (optional, demo)
                </label>
                <label
                  htmlFor="proof"
                  className="flex min-h-12 cursor-pointer items-center gap-2 rounded-control border border-dashed border-line px-3 text-sm text-muted transition hover:border-accent hover:text-foreground focus-within:border-accent"
                >
                  <Upload className="size-4" aria-hidden />
                  <span className="truncate">{proof ? proof.name : "Choose image or PDF"}</span>
                </label>
                <input id="proof" type="file" accept="image/*,application/pdf" onChange={onPickProof} className="sr-only" />
                {proofError ? (
                  <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                    ⚠ {proofError}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted">Preview only. The file stays in your browser.</p>
                )}
              </div>
            </div>
            {proof?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: preview of a local file
              <img src={proof.url} alt={`Preview of ${proof.name}`} className="mt-4 max-h-56 rounded-control border border-line object-contain" />
            ) : null}
          </fieldset>

          <div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" {...register("agree")} className="mt-0.5 size-5 accent-[var(--accent)]" aria-invalid={!!errors.agree} />
              <span>I understand this is a frontend demonstration and no real booking, payment or ticket will be created.</span>
            </label>
            {errors.agree ? (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                ⚠ {errors.agree.message}
              </p>
            ) : null}
          </div>

          <Button type="submit" size="lg" className="w-full sm:w-fit">
            Place demo booking
          </Button>
        </form>

        <aside aria-label="Order summary" className="h-fit rounded-card border border-line bg-elevated p-5 shadow-card lg:sticky lg:top-28">
          <h2 className="display text-2xl">{movie.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {cinema.name} · {screen.name}
          </p>
          <p className="text-sm text-muted">
            <span suppressHydrationWarning>{formatISODate(draft.dateISO)}</span> · {formatTime(showtime.time)}
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
            {seats.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  Seat <strong>{s.id}</strong> <span className="text-muted">· {CATEGORY_LABEL[s.category]}</span>
                </span>
                <span>{formatPrice(s.price)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Tickets ({seats.length})</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">
                Service fee ({formatPrice(SERVICE_FEE_PER_SEAT)} × {seats.length}, demo)
              </dt>
              <dd>{formatPrice(fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactElement<{ id?: string }>;
  className?: string;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>

      {cloneElement(children, { id })}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          ⚠ {error}
        </p>
      ) : null}
    </div>
  );
}
