"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { zonedParts } from "@/lib/formatters";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, Feedback, PageTitle, Panel, Pager, Pill, Section, SelectField, TextField, useAction, useLoad, when, won } from "./kit";

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
  return new Date(guess - offset).toISOString().replace(/\.\d{3}Z$/, "Z"); // the API accepts whole seconds only
}

export function ShowtimesAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [cinema, setCinema] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const cinemas = useLoad(() => adm.get<CinemaLite[]>("/cinemas").then((r) => r.data), "st-cinemas");
  const list = useLoad(() => adm.get<Showtime[]>("/showtimes", { status, cinema, page, per_page: 20 }), `showtimes-${status}-${cinema}-${page}`);

  return (
    <section>
      <PageTitle
        title="Showtimes & Screening Grid"
        eyebrow="Cinema Operations"
        hint="Schedule screenings, allocate screening halls, and configure category seat pricing."
        action={can("showtimes.manage") ? <Button onClick={() => { setCreating(true); setSelectedId(null); }}><Plus className="size-4" aria-hidden /> New showtime</Button> : undefined}
      />
      <Feedback error={act.error} note={act.note} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SelectField id="st-status" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="draft">Draft</option><option value="on_sale">On sale</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option>
        </SelectField>
        <SelectField id="st-cinema" label="Cinema" value={cinema} onChange={(e) => { setCinema(e.target.value); setPage(1); }}>
          <option value="">All my cinemas</option>
          {cinemas.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
      </div>
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(res) => (
          <>
            <DataTable rows={res.data} rowKey={(s) => s.id} onRowClick={(s) => { setSelectedId(s.id); setCreating(false); }} empty="No showtimes match."
              columns={[
                { key: "m", label: "Movie", render: (s) => <span className="font-semibold">{s.movie.title}</span> },
                { key: "c", label: "Cinema / room", render: (s) => `${s.cinema.name} · ${s.room.name}` },
                { key: "t", label: "Starts", render: (s) => when(s.starts_at) },
                { key: "p", label: "From", render: (s) => won(Math.min(...s.prices.map((p) => p.price))) },
                { key: "s", label: "Status", render: (s) => <Pill tone={tone[s.status]}>{s.status.replace("_", " ")}</Pill> },
                {
                  key: "actions",
                  label: "Actions",
                  className: "text-right",
                  render: (s) => (
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setSelectedId(s.id); setCreating(false); }}
                        className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
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
                          className="h-8 px-2 text-xs cursor-pointer"
                        >
                          Publish
                        </Button>
                      )}
                      {can("showtimes.manage") && s.status === "on_sale" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (window.confirm("Cancel this showtime? Customers will need refunds.")) {
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
                    </div>
                  ),
                },
              ]} />
            <Pager page={Number(res.meta?.page ?? 1)} last={Number(res.meta?.last_page ?? 1)} onPage={setPage} />
          </>
        )}
      </Section>
      {creating ? <CreateShowtime cinemas={cinemas.data ?? []} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelectedId(id); list.reload(); }} /> : null}
      {selectedId ? <ShowtimeDetail key={selectedId} id={selectedId} onChanged={list.reload} onClose={() => setSelectedId(null)} /> : null}
    </section>
  );
}

function CreateShowtime({ cinemas, onClose, onCreated }: { cinemas: CinemaLite[]; onClose: () => void; onCreated: (id: string | null) => void }) {
  const act = useAction();
  const movies = useLoad(() => adm.get<MovieLite[]>("/movies", { status: "published", per_page: 100 }).then((r) => r.data), "st-movies");
  const cats = useLoad(() => adm.get<{ key: string; name: string; default_price: number }[]>("/seat-categories").then((r) => r.data), "st-cats");
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
  const layout = useLoad(() => (effectiveRoom ? adm.get<{ seats: { category_key: string; is_active: boolean }[] }>(`/rooms/${effectiveRoom}/seats`).then((r) => r.data.seats) : Promise.resolve([])), `st-layout-${effectiveRoom}`);
  const used = useMemo(() => [...new Set((layout.data ?? []).filter((s) => s.is_active).map((s) => s.category_key))], [layout.data]);

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
  const rangeError = endDate && startDate && endDate < startDate ? "End date must be on or after the start date." : dates.length > MAX_DAYS ? `A range can cover at most ${MAX_DAYS} days.` : null;

  const addTime = () => {
    if (!timeInput || times.includes(timeInput) || times.length >= MAX_TIMES) return;
    setTimes((t) => [...t, timeInput].sort());
    setTimeInput("");
  };
  const total = dates.length * times.length;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!cinema || rangeError || dates.length === 0 || times.length === 0) return;
    const prices = used.map((k) => ({ category_key: k, price: Number(priceOverrides[k] ?? cats.data?.find((c) => c.key === k)?.default_price ?? 0) }));
    // One draft per day and show time in the range. Days the server rejects (e.g. overlaps) are reported, not fatal.
    const r = await act.run(async () => {
      const created: string[] = [];
      const skipped: string[] = [];
      for (const day of dates) {
        for (const time of times) {
          try {
            const res = await adm.post<Showtime>("/showtimes", { movie: movieId, room: effectiveRoom, starts_at: zonedToIso(`${day}T${time}`, cinema.timezone), sales_cutoff_minutes: Number(cutoff), prices });
            created.push(res.data.id);
          } catch (err) {
            if (!(err instanceof ApiError) || err.status === 403 || err.status === 429 || total === 1) throw err;
            skipped.push(`${day} ${time} (${err.message})`);
          }
        }
      }
      if (created.length === 0) throw new Error("none created");
      return { created, skipped };
    }, undefined);
    if (r) {
      if (r.skipped.length > 0) window.alert(`Created ${r.created.length} draft showtime(s). Skipped ${r.skipped.length}: ${r.skipped.join("; ")}`);
      onCreated(r.created.length === 1 ? r.created[0] : null);
    }
  }

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title="New Showtime"
      subtitle="Schedule screening time, assign cinema room, and configure pricing"
      size="lg"
    >
      <form onSubmit={create} noValidate className="grid gap-4" aria-label="New showtime">
        <Feedback error={act.error} note={act.note} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="n-movie" label="Movie (published only)" value={movieId} onChange={(e) => setMovieId(e.target.value)} error={act.fields.movie}>
            <option value="">Choose…</option>
            {movies.data?.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.duration_min} min)</option>)}
          </SelectField>
          <SelectField id="n-cinema" label="Cinema" value={cinemaId} onChange={(e) => { setCinemaId(e.target.value); setRoomId(""); }}>
            {cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField id="n-room" label="Room" value={effectiveRoom} onChange={(e) => setRoomId(e.target.value)} error={act.fields.room}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectField>
          <TextField id="n-start-date" label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={act.fields.starts_at} />
          <TextField id="n-end-date" label="End date (optional)" type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} error={rangeError ?? undefined} hint="Leave empty for a single day" />
          <div className="sm:col-span-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <TextField id="n-time" label={`Show times (${cinema?.timezone ?? "local"})`} type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTime(); } }} hint="Pick a time and press Add. Repeat for every screening of the day." />
              </div>
              <Button type="button" variant="secondary" onClick={addTime} disabled={!timeInput || times.includes(timeInput) || times.length >= MAX_TIMES} className="mb-6">Add time</Button>
            </div>
            {times.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected show times">
                {times.map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-1 pl-3 pr-1.5 text-sm font-semibold">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => setTimes((x) => x.filter((v) => v !== t))} className="grid size-5 cursor-pointer place-items-center rounded-full text-muted hover:bg-foreground/10 hover:text-foreground">✕</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <TextField id="n-cut" label="Stop sales (minutes before start)" inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} error={act.fields.sales_cutoff_minutes} />
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold">Seat prices (KRW, whole won)</legend>
          {used.map((k) => (
            <TextField key={k} id={`price-${k}`} label={cats.data?.find((c) => c.key === k)?.name ?? k} inputMode="numeric"
              value={priceOverrides[k] ?? String(cats.data?.find((c) => c.key === k)?.default_price ?? "")} onChange={(e) => setPriceOverrides((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, "") }))} />
          ))}
          {used.length === 0 ? <p className="text-sm text-muted sm:col-span-3">This room has no seats yet. Define its seat layout first.</p> : null}
          {act.fields.prices ? <p role="alert" className="text-sm text-red-500 sm:col-span-3">{act.fields.prices}</p> : null}
        </fieldset>
        <p className="text-xs text-muted">With an end date, one draft is created per day for every show time. The server blocks overlaps in the same room, including a turnaround buffer after the film.</p>
        <div className="flex gap-3"><Button type="submit" disabled={act.busy || !movieId || !startDate || times.length === 0 || !!rangeError || used.length === 0}>{act.busy ? "Creating…" : total > 1 ? `Create ${total} drafts` : "Create draft"}</Button><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div>
      </form>
    </AdminModal>
  );
}

function ShowtimeDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { can } = useAuth();
  const act = useAction();
  const d = useLoad(() => adm.get<Showtime>(`/showtimes/${id}`).then((r) => r.data), `st-${id}`);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [reschedule, setReschedule] = useState("");

  const refresh = () => { d.reload(); onChanged(); };

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title="Showtime Details"
      subtitle="Seat availability, category pricing, rescheduling, and sales status"
      size="lg"
    >
      <Section loading={d.loading} error={d.error} data={d.data}>
        {(s) => (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="display text-3xl">{s.movie.title}</h3>
              <Pill tone={tone[s.status]}>{s.status.replace("_", " ")}</Pill>
            </div>
            <p className="text-muted">{s.cinema.name} · {s.room.name} · {when(s.starts_at)}</p>
            {s.seat_counts ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                {Object.entries(s.seat_counts).map(([k, v]) => <div key={k} className="rounded-control border border-line p-3"><dt className="capitalize text-muted">{k}</dt><dd className="display text-2xl">{v}</dd></div>)}
              </dl>
            ) : null}
            <Feedback error={act.error} note={act.note} />

            {can("prices.manage") && (s.status === "draft" || s.status === "on_sale") ? (
              <form className="grid gap-3 sm:grid-cols-3" aria-label="Seat prices" onSubmit={async (e) => {
                e.preventDefault();
                if (await act.run(() => adm.put(`/showtimes/${id}/prices`, { prices: s.prices.map((p) => ({ category_key: p.category_key, price: Number(prices[p.category_key] ?? p.price) })) }), "Prices updated.")) refresh();
              }}>
                {s.prices.map((p) => <TextField key={p.category_key} id={`ep-${p.category_key}`} label={`${p.category_name} (KRW)`} inputMode="numeric" value={prices[p.category_key] ?? String(p.price)} onChange={(e) => setPrices((x) => ({ ...x, [p.category_key]: e.target.value.replace(/\D/g, "") }))} />)}
                <div className="sm:col-span-3"><Button type="submit" size="sm" disabled={act.busy}>Save prices</Button> <span className="text-xs text-muted">Not possible once bookings exist.</span></div>
              </form>
            ) : null}

            {can("showtimes.manage") && (s.status === "draft" || s.status === "on_sale") ? (
              <form className="flex flex-wrap items-end gap-3" aria-label="Reschedule" onSubmit={async (e) => {
                e.preventDefault();
                if (reschedule && (await act.run(() => adm.patch(`/showtimes/${id}`, { starts_at: zonedToIso(reschedule, s.cinema.timezone) }), "Rescheduled."))) refresh();
              }}>
                <div className="min-w-60"><TextField id="resched" label={`Move to (${s.cinema.timezone})`} type="datetime-local" value={reschedule} onChange={(e) => setReschedule(e.target.value)} error={act.fields.starts_at} /></div>
                <Button type="submit" size="sm" variant="secondary" disabled={act.busy || !reschedule}>Reschedule</Button>
              </form>
            ) : null}

            {can("showtimes.manage") ? (
              <div className="flex flex-wrap gap-3">
                {s.status === "draft" ? <Button disabled={act.busy} onClick={async () => { if (await act.run(() => adm.post(`/showtimes/${id}/publish`), "Now on sale.")) refresh(); }}>Put on sale</Button> : null}
                {s.status === "draft" || s.status === "on_sale" ? <Button variant="secondary" disabled={act.busy} onClick={async () => { if (window.confirm("Cancel this showtime? This cannot be undone.") && (await act.run(() => adm.post(`/showtimes/${id}/cancel`), "Cancelled."))) refresh(); }}>Cancel showtime</Button> : null}
                <Button variant="ghost" onClick={onClose}>Close</Button>
              </div>
            ) : <Button variant="ghost" onClick={onClose}>Close</Button>}
          </div>
        )}
      </Section>
    </AdminModal>
  );
}
