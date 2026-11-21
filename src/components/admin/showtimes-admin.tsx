"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Clock, Edit2, Film, Plus, Sparkles, Tag, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { zonedParts } from "@/lib/formatters";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { confirmDialog, alertDialog } from "@/components/ui/dialogs";
import { AdminModal, DataTable, Feedback, PageTitle, Pager, Pill, Section, SelectField, TextField, useAction, useLoad, when, won } from "./kit";
import { cn } from "@/lib/utils";

interface Showtime {
  id: string;
  status: "draft" | "on_sale" | "cancelled" | "completed";
  starts_at: string;
  sales_cutoff_minutes: number;
  movie: { slug: string; title: string; duration_min: number };
  cinema: { slug: string; name: string; timezone: string };
  room: { id: string; name: string };
  prices: { category_key: string; category_name: string; price: number }[];
  seat_counts?: { total: number; available: number; held: number; sold: number; unavailable: number };
}
interface CinemaLite { id: string; name: string; timezone: string; rooms: { id: string; name: string; is_active: boolean }[] }
interface MovieLite { id: string; title: string; duration_min: number }

const MAX_DAYS = 60;
const MAX_TIMES = 12;
/** Slots per bulk request (the API accepts at most 100). */
const BULK_SIZE = 100;
const tone = { draft: "neutral", on_sale: "good", cancelled: "bad", completed: "warn" } as const;

/** "2026-12-01T19:30" typed in a cinema's time zone -> an ISO string with that zone's real offset. */
export function zonedToIso(local: string, timeZone: string): string {
  const [d, t] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const p = zonedParts(new Date(guess).toISOString(), timeZone);
  const [py, pmo, pda] = p.date.split("-").map(Number);
  const [ph, pmi] = p.time.split(":").map(Number);
  const offset = Date.UTC(py, pmo - 1, pda, ph, pmi) - guess;
  return new Date(guess - offset).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Skip reasons for bulk results: identical reasons are grouped with a count, the list scrolls when long. */
function SkipList({ items }: { items: string[] }) {
  const counts = new Map<string, number>();
  items.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  return (
    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line/60 bg-surface/50 p-2.5 text-xs">
      {[...counts].map(([reason, n]) => (
        <li key={reason}>
          {n > 1 ? <span className="font-semibold text-foreground">{n}× </span> : null}
          {reason}
        </li>
      ))}
    </ul>
  );
}

export function ShowtimesAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [cinema, setCinema] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const canManage = can("showtimes.manage");

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function remove(ids: string[]) {
    if (ids.length === 0) return;
    const what = ids.length === 1 ? "this showtime" : `${ids.length} showtimes`;
    if (!(await confirmDialog({ title: `Delete ${what}?`, message: "This cannot be undone. Showtimes that already have bookings are skipped.", confirmLabel: "Delete", danger: true }))) return;
    const r = await act.run(
      () => adm.post<{ deleted: string[]; skipped: { id: string; reason: string }[] }>("/showtimes/bulk-delete", { ids }).then((x) => x.data),
      undefined,
    );
    if (!r) return;
    if (r.skipped.length > 0) {
      await alertDialog({ title: `Deleted ${r.deleted.length}, skipped ${r.skipped.length}`, message: <SkipList items={r.skipped.map((s) => s.reason)} /> });
    }
    setChecked(new Set());
    if (selectedId && r.deleted.includes(selectedId)) setSelectedId(null);
    list.reload();
  }

  /** `ids` publishes those drafts; `null` publishes every future draft (in the cinema filter, if set). */
  async function publish(ids: string[] | null) {
    const scope = cinema ? ` at ${cinemas.data?.find((c) => c.id === cinema)?.name ?? "this cinema"}` : "";
    const what = ids === null ? `all draft showtimes${scope}` : ids.length === 1 ? "this showtime" : `${ids.length} showtimes`;
    if (!(await confirmDialog({ title: `Put ${what} on sale?`, message: "Customers will be able to book them right away.", confirmLabel: "Publish", tone: "success" }))) return;
    const body = ids === null ? { all: true, cinema: cinema || null } : { ids };
    const r = await act.run(
      () => adm.post<{ published: string[]; skipped: { id: string; reason: string }[] }>("/showtimes/bulk-publish", body).then((x) => x.data),
      undefined,
    );
    if (!r) return;
    await alertDialog({ title: `${r.published.length} showtime(s) on sale`, tone: r.skipped.length > 0 ? "default" : "success", message: r.skipped.length > 0 ? <><p>Skipped {r.skipped.length}:</p><SkipList items={r.skipped.map((s) => s.reason)} /></> : undefined });
    setChecked(new Set());
    list.reload();
  }

  const cinemas = useLoad(() => adm.get<CinemaLite[]>("/cinemas").then((r) => r.data), "st-cinemas");
  const list = useLoad(
    () => adm.get<Showtime[]>("/showtimes", { status, cinema, page, per_page: 20 }),
    `showtimes-${status}-${cinema}-${page}`,
  );

  return (
    <section className="space-y-6">
      <PageTitle
        title="Showtimes & Screening Grid"
        eyebrow="Cinema Operations"
        icon={CalendarClock}
        hint="Schedule movie screenings, allocate auditorium halls, manage recurring timetables, and configure seat pricing tiers."
        action={
          can("showtimes.manage") ? (
            <Button
              onClick={() => {
                setCreating(true);
                setSelectedId(null);
              }}
              className="shadow-sm"
            >
              <Plus className="size-4 mr-1.5" aria-hidden />
              <span>Schedule showtime</span>
            </Button>
          ) : undefined
        }
      />

      <Feedback error={act.error} note={act.note} />

      {/* Modern Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 rounded-2xl border border-line/70 bg-elevated/70 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex-1">
          <SelectField
            id="st-status"
            label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setChecked(new Set());
            }}
          >
            <option value="">All statuses</option>
            <option value="on_sale">On sale (Active)</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </SelectField>
        </div>
        <div className="flex-1">
          <SelectField
            id="st-cinema"
            label="Filter cinema venue"
            value={cinema}
            onChange={(e) => {
              setCinema(e.target.value);
              setPage(1);
              setChecked(new Set());
            }}
          >
            <option value="">All cinema venues</option>
            {cinemas.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
        {canManage && (
          <Button
            variant="secondary"
            disabled={act.busy}
            onClick={() => publish(null)}
            className="h-11 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
          >
            Publish all drafts
          </Button>
        )}
      </div>

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => {
          const pageIds = res.data.map((s) => s.id);
          const picked = pageIds.filter((id) => checked.has(id));
          const allPicked = pageIds.length > 0 && picked.length === pageIds.length;
          const pickedDrafts = res.data.filter((s) => s.status === "draft" && checked.has(s.id)).map((s) => s.id);
          return (
          <>
            {canManage && picked.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5">
                <span className="text-sm font-semibold text-foreground">{picked.length} selected</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())} className="h-8 text-xs cursor-pointer">
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={act.busy || pickedDrafts.length === 0}
                    onClick={() => publish(pickedDrafts)}
                    className="h-8 px-2.5 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    Publish selected{pickedDrafts.length !== picked.length ? ` (${pickedDrafts.length} drafts)` : ""}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={act.busy}
                    onClick={() => remove(picked)}
                    className="h-8 px-2.5 text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="size-3.5 mr-1" aria-hidden />
                    <span>Delete selected</span>
                  </Button>
                </div>
              </div>
            )}
            <DataTable
              rows={res.data}
              rowKey={(s) => s.id}
              onRowClick={(s) => {
                setSelectedId(s.id);
                setCreating(false);
              }}
              empty="No showtimes match your filter."
              columns={[
                ...(canManage
                  ? [
                      {
                        key: "sel",
                        className: "w-10",
                        label: (
                          <input
                            type="checkbox"
                            aria-label="Select all showtimes on this page"
                            checked={allPicked}
                            ref={(el) => {
                              if (el) el.indeterminate = picked.length > 0 && !allPicked;
                            }}
                            onChange={() =>
                              setChecked((prev) => {
                                const next = new Set(prev);
                                pageIds.forEach((id) => (allPicked ? next.delete(id) : next.add(id)));
                                return next;
                              })
                            }
                            className="size-4 cursor-pointer accent-[var(--accent)]"
                          />
                        ),
                        render: (s: Showtime) => (
                          <input
                            type="checkbox"
                            aria-label={`Select ${s.movie.title} at ${when(s.starts_at)}`}
                            checked={checked.has(s.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggle(s.id)}
                            className="size-4 cursor-pointer accent-[var(--accent)]"
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  key: "m",
                  label: "Movie Title",
                  render: (s) => (
                    <div>
                      <span className="font-bold text-foreground block">{s.movie.title}</span>
                      <span className="text-xs text-muted">{s.movie.duration_min} minutes</span>
                    </div>
                  ),
                },
                {
                  key: "c",
                  label: "Venue & Hall",
                  render: (s) => (
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">{s.cinema.name}</span>
                      <span className="block text-muted mt-0.5">{s.room.name}</span>
                    </div>
                  ),
                },
                {
                  key: "t",
                  label: "Showtime (Starts)",
                  render: (s) => (
                    <div className="text-xs">
                      <span className="font-semibold text-foreground block">{when(s.starts_at)}</span>
                      <span className="text-muted">Cutoff: -{s.sales_cutoff_minutes}m</span>
                    </div>
                  ),
                },
                {
                  key: "p",
                  label: "Starting Price",
                  render: (s) => (
                    <span className="font-bold text-accent text-xs">
                      {won(Math.min(...s.prices.map((p) => p.price)))}
                    </span>
                  ),
                },
                {
                  key: "s",
                  label: "Status",
                  render: (s) => (
                    <Pill tone={tone[s.status]}>{s.status.replace("_", " ")}</Pill>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  render: (s) => (
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedId(s.id);
                          setCreating(false);
                        }}
                        className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                      >
                        <Edit2 className="size-3.5 mr-1" />
                        <span>Edit</span>
                      </Button>

                      {can("showtimes.manage") && s.status === "draft" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (await act.run(() => adm.post(`/showtimes/${s.id}/publish`), "Published.")) {
                              list.reload();
                            }
                          }}
                          className="h-8 px-2.5 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                        >
                          Publish
                        </Button>
                      )}

                      {can("showtimes.manage") && s.status === "on_sale" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (await confirmDialog({ title: "Cancel this showtime?", message: "It is taken off sale. This cannot be undone.", confirmLabel: "Cancel showtime", cancelLabel: "Keep", danger: true })) {
                              if (await act.run(() => adm.post(`/showtimes/${s.id}/cancel`), "Cancelled.")) {
                                list.reload();
                              }
                            }
                          }}
                          className="h-8 px-2 text-xs text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        >
                          Cancel
                        </Button>
                      )}

                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${s.movie.title} at ${when(s.starts_at)}`}
                          disabled={act.busy}
                          onClick={() => remove([s.id])}
                          className="h-8 px-2 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <Pager
              page={Number(res.meta?.page ?? 1)}
              last={Number(res.meta?.last_page ?? 1)}
              onPage={(p) => {
                setPage(p);
                setChecked(new Set());
              }}
            />
          </>
          );
        }}
      </Section>

      {creating ? (
        <CreateShowtime
          cinemas={cinemas.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
            list.reload();
          }}
        />
      ) : null}

      {selectedId ? (
        <ShowtimeDetail
          key={selectedId}
          id={selectedId}
          onChanged={list.reload}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </section>
  );
}

function CreateShowtime({
  cinemas,
  onClose,
  onCreated,
}: {
  cinemas: CinemaLite[];
  onClose: () => void;
  onCreated: (id: string | null) => void;
}) {
  const act = useAction();
  const movies = useLoad(
    () => adm.get<MovieLite[]>("/movies", { status: "published", per_page: 100 }).then((r) => r.data),
    "st-movies",
  );
  const cats = useLoad(
    () => adm.get<{ key: string; name: string; default_price: number }[]>("/seat-categories").then((r) => r.data),
    "st-cats",
  );
  const [pickedCinema, setCinemaId] = useState("");
  const cinemaId = pickedCinema || cinemas[0]?.id || "";
  const [roomId, setRoomId] = useState("");
  const [movieId, setMovieId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [cutoff, setCutoff] = useState("15");
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});

  const cinema = cinemas.find((c) => c.id === cinemaId);
  const rooms = cinema?.rooms.filter((r) => r.is_active) ?? [];
  const effectiveRoom = roomId || rooms[0]?.id || "";
  const layout = useLoad(
    () =>
      effectiveRoom
        ? adm.get<{ seats: { category_key: string; is_active: boolean }[] }>(`/rooms/${effectiveRoom}/seats`).then((r) => r.data.seats)
        : Promise.resolve([]),
    `st-layout-${effectiveRoom}`,
  );
  const used = useMemo(
    () => [...new Set((layout.data ?? []).filter((s) => s.is_active).map((s) => s.category_key))],
    [layout.data],
  );

  const lastDate = endDate || startDate;
  const dates = useMemo(() => {
    if (!startDate || !lastDate || lastDate < startDate) return [];
    const out: string[] = [];
    const cur = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${lastDate}T00:00:00Z`);
    while (cur <= end && out.length <= MAX_DAYS) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }, [startDate, lastDate]);

  const rangeError =
    endDate && startDate && endDate < startDate
      ? "End date must be on or after the start date."
      : dates.length > MAX_DAYS
      ? `A range can cover at most ${MAX_DAYS} days.`
      : null;

  const addTime = () => {
    if (!timeInput || times.includes(timeInput) || times.length >= MAX_TIMES) return;
    setTimes((t) => [...t, timeInput].sort());
    setTimeInput("");
  };
  const total = dates.length * times.length;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!cinema || rangeError || dates.length === 0 || times.length === 0) return;
    const prices = used.map((k) => ({
      category_key: k,
      price: Number(priceOverrides[k] ?? cats.data?.find((c) => c.key === k)?.default_price ?? 0),
    }));

    const r = await act.run(async () => {
      const base = { movie: movieId, room: effectiveRoom, sales_cutoff_minutes: Number(cutoff), prices };
      const slots = dates.flatMap((day) => times.map((time) => ({ label: `${day} ${time}`, iso: zonedToIso(`${day}T${time}`, cinema.timezone) })));

      // One slot: the plain endpoint, so validation errors land on the form fields.
      if (slots.length === 1) {
        const res = await adm.post<Showtime>("/showtimes", { ...base, starts_at: slots[0].iso });
        return { created: [res.data.id], skipped: [] as string[] };
      }

      // A range: the bulk endpoint, BULK_SIZE slots per request (a 60-day x 12-time range is 8 requests, not 720).
      const label = new Map(slots.map((x) => [x.iso, x.label]));
      const created: string[] = [];
      const skipped: string[] = [];
      for (let i = 0; i < slots.length; i += BULK_SIZE) {
        const res = await adm.post<{ created: string[]; skipped: { starts_at: string; reason: string }[] }>("/showtimes/bulk", {
          ...base,
          starts_at: slots.slice(i, i + BULK_SIZE).map((x) => x.iso),
        });
        created.push(...res.data.created);
        skipped.push(...res.data.skipped.map((x) => `${label.get(x.starts_at) ?? x.starts_at} (${x.reason})`));
      }
      if (created.length === 0) throw new ApiError(`No showtimes were created. ${skipped.slice(0, 3).join("; ")}`, 422);
      return { created, skipped };
    }, undefined);

    if (r) {
      if (r.skipped.length > 0) {
        await alertDialog({ title: `Created ${r.created.length} draft showtime(s)`, message: <><p>Skipped {r.skipped.length}:</p><SkipList items={r.skipped} /></> });
      }
      onCreated(r.created.length === 1 ? r.created[0] : null);
    }
  }

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title="Schedule Showtime"
      subtitle="Select movie, hall allocation, start times, and category seat pricing"
      size="lg"
    >
      <form onSubmit={create} noValidate className="space-y-5" aria-label="New showtime">
        <Feedback error={act.error} note={act.note} />

        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="n-movie"
              label="Movie Title (Published)"
              value={movieId}
              onChange={(e) => setMovieId(e.target.value)}
              error={act.fields.movie}
            >
              <option value="">Select a title…</option>
              {movies.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.duration_min} min)
                </option>
              ))}
            </SelectField>

            <SelectField
              id="n-cinema"
              label="Cinema Venue"
              value={cinemaId}
              onChange={(e) => {
                setCinemaId(e.target.value);
                setRoomId("");
              }}
            >
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="n-room"
              label="Screening Hall"
              value={effectiveRoom}
              onChange={(e) => setRoomId(e.target.value)}
              error={act.fields.room}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>

            <TextField
              id="n-cut"
              label="Sales Cutoff (Minutes before start)"
              inputMode="numeric"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              error={act.fields.sales_cutoff_minutes}
            />

            <TextField
              id="n-start-date"
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={act.fields.starts_at}
            />

            <TextField
              id="n-end-date"
              label="End Date (Optional for recurring)"
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={rangeError ?? undefined}
              hint="Leave blank for single day screening"
            />
          </div>

          {/* Show Times Picker */}
          <div className="rounded-xl border border-line/60 bg-surface/60 p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Screening Times ({cinema?.timezone ?? "Local Time"})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTime();
                  }
                }}
                className="h-10 rounded-xl border border-line/70 bg-background/90 px-3 text-sm outline-none focus:border-accent"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addTime}
                disabled={!timeInput || times.includes(timeInput) || times.length >= MAX_TIMES}
                className="h-10 px-3 cursor-pointer"
              >
                <Plus className="size-3.5 mr-1" />
                <span>Add Time</span>
              </Button>
            </div>

            {times.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Selected show times">
                {times.map((t) => (
                  <li
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-1 pl-3 pr-1.5 text-xs font-bold text-accent"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => setTimes((x) => x.filter((v) => v !== t))}
                      className="grid size-4 cursor-pointer place-items-center rounded-full text-accent hover:bg-accent/20"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Seat Price Tiers */}
        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Seat Category Pricing (KRW)
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {used.map((k) => (
              <TextField
                key={k}
                id={`price-${k}`}
                label={cats.data?.find((c) => c.key === k)?.name ?? k}
                inputMode="numeric"
                value={priceOverrides[k] ?? String(cats.data?.find((c) => c.key === k)?.default_price ?? "")}
                onChange={(e) =>
                  setPriceOverrides((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, "") }))
                }
              />
            ))}
          </div>
          {used.length === 0 && (
            <p className="text-xs text-muted italic">This hall has no seats configured yet.</p>
          )}
          {act.fields.prices && (
            <p role="alert" className="text-xs text-rose-500 font-medium">
              {act.fields.prices}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line/60 pt-4">
          <Button
            type="submit"
            disabled={act.busy || !movieId || !startDate || times.length === 0 || !!rangeError || used.length === 0}
            className="shadow-sm"
          >
            {act.busy ? "Creating…" : total > 1 ? `Create ${total} Showtimes` : "Create Draft"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </form>
    </AdminModal>
  );
}

function ShowtimeDetail({
  id,
  onChanged,
  onClose,
}: {
  id: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { can } = useAuth();
  const act = useAction();
  const d = useLoad(() => adm.get<Showtime>(`/showtimes/${id}`).then((r) => r.data), `st-${id}`);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [reschedule, setReschedule] = useState("");

  const refresh = () => {
    d.reload();
    onChanged();
  };

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title="Showtime Details"
      subtitle="Seat inventory, ticket price adjustments, schedule changes, and sales status"
      size="lg"
    >
      <Section loading={d.loading} error={d.error} data={d.data}>
        {(s) => (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-4">
              <div>
                <h3 className="display text-2xl font-bold text-foreground">{s.movie.title}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {s.cinema.name} · {s.room.name} · {when(s.starts_at)}
                </p>
              </div>
              <Pill tone={tone[s.status]}>{s.status.replace("_", " ")}</Pill>
            </div>

            {/* Seat Telemetry Grid */}
            {s.seat_counts && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 text-center">
                <div className="rounded-xl border border-line/60 bg-surface/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-muted">Total</span>
                  <p className="text-xl font-extrabold text-foreground mt-1">{s.seat_counts.total}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Available</span>
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{s.seat_counts.available}</p>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                  <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">Sold</span>
                  <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">{s.seat_counts.sold}</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Held</span>
                  <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{s.seat_counts.held}</p>
                </div>
                <div className="rounded-xl border border-line/60 bg-surface/50 p-3">
                  <span className="text-[10px] font-bold uppercase text-muted">Unavailable</span>
                  <p className="text-xl font-extrabold text-muted mt-1">{s.seat_counts.unavailable}</p>
                </div>
              </div>
            )}

            <Feedback error={act.error} note={act.note} />

            {/* Price Adjustments */}
            {can("prices.manage") && (s.status === "draft" || s.status === "on_sale") && (
              <form
                className="rounded-2xl border border-line/60 bg-surface/40 p-4 space-y-3"
                aria-label="Seat prices"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act.run(
                      () =>
                        adm.put(`/showtimes/${id}/prices`, {
                          prices: s.prices.map((p) => ({
                            category_key: p.category_key,
                            price: Number(prices[p.category_key] ?? p.price),
                          })),
                        }),
                      "Prices updated.",
                    )
                  ) {
                    refresh();
                  }
                }}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Update Category Prices (KRW)</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {s.prices.map((p) => (
                    <TextField
                      key={p.category_key}
                      id={`ep-${p.category_key}`}
                      label={p.category_name}
                      inputMode="numeric"
                      value={prices[p.category_key] ?? String(p.price)}
                      onChange={(e) =>
                        setPrices((x) => ({
                          ...x,
                          [p.category_key]: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" size="sm" disabled={act.busy}>
                    Save Prices
                  </Button>
                  <span className="text-[11px] text-muted">Note: Price edits are locked once customer reservations exist.</span>
                </div>
              </form>
            )}

            {/* Reschedule Screening */}
            {can("showtimes.manage") && (s.status === "draft" || s.status === "on_sale") && (
              <form
                className="rounded-2xl border border-line/60 bg-surface/40 p-4 space-y-3"
                aria-label="Reschedule"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    reschedule &&
                    (await act.run(
                      () =>
                        adm.patch(`/showtimes/${id}`, {
                          starts_at: zonedToIso(reschedule, s.cinema.timezone),
                        }),
                      "Rescheduled.",
                    ))
                  ) {
                    refresh();
                  }
                }}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Reschedule Screening</h4>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-60 flex-1">
                    <TextField
                      id="resched"
                      label={`New Starting Time (${s.cinema.timezone})`}
                      type="datetime-local"
                      value={reschedule}
                      onChange={(e) => setReschedule(e.target.value)}
                      error={act.fields.starts_at}
                    />
                  </div>
                  <Button type="submit" size="sm" variant="secondary" disabled={act.busy || !reschedule} className="h-11">
                    Update Showtime
                  </Button>
                </div>
              </form>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
              <div className="flex items-center gap-2.5">
                {can("showtimes.manage") && s.status === "draft" && (
                  <Button
                    disabled={act.busy}
                    onClick={async () => {
                      if (await act.run(() => adm.post(`/showtimes/${id}/publish`), "Now on sale.")) refresh();
                    }}
                    className="shadow-sm"
                  >
                    Put On Sale
                  </Button>
                )}
                {can("showtimes.manage") && (s.status === "draft" || s.status === "on_sale") && (
                  <Button
                    variant="secondary"
                    disabled={act.busy}
                    onClick={async () => {
                      if (
                        (await confirmDialog({ title: "Cancel this showtime?", message: "It is taken off sale. This cannot be undone.", confirmLabel: "Cancel showtime", cancelLabel: "Keep", danger: true })) &&
                        (await act.run(() => adm.post(`/showtimes/${id}/cancel`), "Cancelled."))
                      ) {
                        refresh();
                      }
                    }}
                    className="text-rose-500 hover:bg-rose-500/10"
                  >
                    Cancel Showtime
                  </Button>
                )}
              </div>
              <Button variant="ghost" onClick={onClose} className="cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        )}
      </Section>
    </AdminModal>
  );
}
