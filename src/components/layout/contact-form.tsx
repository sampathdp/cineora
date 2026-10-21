"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  subject: z.string().trim().min(3, "Add a short subject."),
  message: z.string().trim().min(10, "Message should be at least 10 characters."),
});
type Values = z.infer<typeof schema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-card border border-accent/50 bg-accent/10 p-6">
        <CheckCircle2 className="size-8 text-accent-text" aria-hidden />
        <h2 className="display text-3xl">Message validated</h2>
        <p className="text-muted">
          Demo only: your message was <strong>not</strong> sent or stored anywhere. In a real build this is where a backend would take over.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            reset();
            setSent(false);
          }}
        >
          Write another
        </Button>
      </div>
    );
  }

  const input = (bad: boolean) =>
    `w-full rounded-control border bg-background px-3 text-base outline-none placeholder:text-muted focus:border-accent ${bad ? "border-red-500" : "border-line"}`;

  return (
    <form onSubmit={handleSubmit(() => setSent(true))} noValidate className="grid gap-5 sm:grid-cols-2" aria-label="Contact form (demo)">
      <div>
        <label htmlFor="c-name" className="mb-1.5 block text-sm font-semibold">
          Name
        </label>
        <input id="c-name" {...register("name")} autoComplete="name" className={input(!!errors.name) + " h-12"} aria-invalid={!!errors.name} />
        <Err msg={errors.name?.message} />
      </div>
      <div>
        <label htmlFor="c-email" className="mb-1.5 block text-sm font-semibold">
          Email
        </label>
        <input id="c-email" type="email" {...register("email")} autoComplete="email" className={input(!!errors.email) + " h-12"} aria-invalid={!!errors.email} />
        <Err msg={errors.email?.message} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-subject" className="mb-1.5 block text-sm font-semibold">
          Subject
        </label>
        <input id="c-subject" {...register("subject")} className={input(!!errors.subject) + " h-12"} aria-invalid={!!errors.subject} />
        <Err msg={errors.subject?.message} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-message" className="mb-1.5 block text-sm font-semibold">
          Message
        </label>
        <textarea id="c-message" rows={6} {...register("message")} className={input(!!errors.message) + " py-3"} aria-invalid={!!errors.message} />
        <Err msg={errors.message?.message} />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" size="lg">
          Send message
        </Button>
        <p className="text-sm text-muted">Frontend demo: nothing is sent.</p>
      </div>
    </form>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
      ⚠ {msg}
    </p>
  ) : null;
}
