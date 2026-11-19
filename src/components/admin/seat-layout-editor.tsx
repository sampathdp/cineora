"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Box, MousePointerClick, Paintbrush, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Feedback, PageTitle, Section, useAction, useLoad } from "./kit";
import { cn } from "@/lib/utils";

interface CinemaRooms { id: string; name: string; rooms: { id: string; name: string }[] }

/** Full-page seat layout editor for one screening room. */
export function SeatLayoutPage({ roomId }: { roomId: string }) {
  const list = useLoad(() => adm.get<CinemaRooms[]>("/cinemas").then((r) => r.data), "cinemas");
  return (
    <Section loading={list.loading} error={list.error} data={list.data}>
      {(cinemas) => {
        const cinema = cinemas.find((c) => c.rooms.some((r) => r.id === roomId));
        const room = cinema?.rooms.find((r) => r.id === roomId);
        if (!cinema || !room) return <p className="text-sm text-muted">Room not found, or you are not assigned to its cinema.</p>;
        return <SeatLayout room={room} cinemaName={cinema.name} />;
      }}
    </Section>
  );
}

interface RowSpec { label: string; count: number; category: string }

const catStyle: Record<string, string> = {
  standard: "border-black/25 bg-foreground/15 text-foreground hover:bg-foreground/30",
  premium: "border-black/25 bg-accent/25 text-foreground hover:bg-accent/50",
  lounge: "border-black/25 bg-violet-400/30 text-foreground hover:bg-violet-400/55",
};
const fallbackStyle = "border-black/25 bg-sky-400/30 text-foreground hover:bg-sky-400/55";
const styleFor = (category: string) => catStyle[category.toLowerCase()] ?? fallbackStyle;

/** Rows-and-seats grid editor with live ticket-booking visual preview & per-seat manual overrides */
function SeatLayout({ room, cinemaName }: { room: { id: string; name: string }; cinemaName: string }) {
  const router = useRouter();
  const act = useAction();
  const [view3d, setView3d] = useState(true);
  const cats = useLoad(() => adm.get<{ key: string; name: string; default_price: number }[]>("/seat-categories").then((r) => r.data), "seat-cats");
  const current = useLoad(
    () => adm.get<{ seats: { row_label: string; number: number; category_key: string; is_active: boolean; x: number | null }[] }>(`/rooms/${room.id}/seats`).then((r) => r.data.seats),
    `layout-${room.id}`,
  );
  const [rows, setRows] = useState<RowSpec[] | null>(null);

  // Per-seat manual overrides: key "Row-Number" (e.g. "A-1") -> category_key | "inactive"
  const [seatOverrides, setSeatOverrides] = useState<Record<string, string>>({});
  const [syncedRoomId, setSyncedRoomId] = useState<string | null>(null);

  // Walkways: key "Row-N" means a gap right before seat N (the clicked seat moves right). Seat numbers never change; only grid columns shift.
  const [aisles, setAisles] = useState<Record<string, number>>({});

  // Active tool: "select" (inspect/edit mode), "inactive" (disable brush), "aisle" (walkway brush), or category key (e.g. "premium")
  const [activeTool, setActiveTool] = useState<string>("select");
  const [selectedSeat, setSelectedSeat] = useState<{ row: string; number: number } | null>(null);

  // Initialise the editable rows once the current layout has loaded.
  const derived: RowSpec[] | null = useMemo(() => {
    if (!current.data) return null;
    return Object.values(
      current.data.reduce<Record<string, RowSpec>>((acc, s) => {
        acc[s.row_label] ??= { label: s.row_label, count: 0, category: s.category_key };
        acc[s.row_label].count = Math.max(acc[s.row_label].count, s.number);
        return acc;
      }, {}),
    );
  }, [current.data]);

  // Synchronise existing seat overrides from backend when room data loads
  useEffect(() => {
    if (current.data && syncedRoomId !== room.id) {
      const overrides: Record<string, string> = {};
      const rowTiers: Record<string, Record<string, number>> = {};

      for (const s of current.data) {
        if (!s.is_active) {
          overrides[`${s.row_label}-${s.number}`] = "inactive";
          continue;
        }
        rowTiers[s.row_label] ??= {};
        rowTiers[s.row_label][s.category_key] = (rowTiers[s.row_label][s.category_key] ?? 0) + 1;
      }

      // Detect seats whose category deviates from the row's dominant tier
      for (const s of current.data) {
        if (!s.is_active) continue;
        const counts = rowTiers[s.row_label] ?? {};
        let dominant = s.category_key;
        let max = 0;
        for (const [k, v] of Object.entries(counts)) {
          if (v > max) {
            max = v;
            dominant = k;
          }
        }
        if (s.category_key !== dominant) {
          overrides[`${s.row_label}-${s.number}`] = s.category_key;
        }
      }

      // Walkways are stored as a jump in x between neighbouring active seats that is larger than their number jump.
      const found: Record<string, number> = {};
      const byRow: Record<string, { number: number; x: number }[]> = {};
      for (const s of current.data) {
        if (!s.is_active || s.x == null) continue;
        (byRow[s.row_label] ??= []).push({ number: s.number, x: s.x });
      }
      for (const [label, list] of Object.entries(byRow)) {
        list.sort((a, b) => a.number - b.number);
        let prevOffset = 0;
        for (const seat of list) {
          const offset = seat.x - seat.number;
          if (offset > prevOffset) found[`${label}-${seat.number}`] = offset - prevOffset;
          prevOffset = offset;
        }
      }

      setSeatOverrides(overrides);
      setAisles(found);
      setSyncedRoomId(room.id);
    }
  }, [current.data, room.id, syncedRoomId]);

  const editable = rows ?? derived ?? [];
  /** Grid column of seat `n`: its number plus one per walkway placed at or before it. */
  const colOf = (row: string, n: number) => {
    let c = n;
    for (let i = 1; i <= n; i++) c += aisles[`${row}-${i}`] ?? 0;
    return c;
  };
  const maxSeats = Math.max(...editable.map((r) => colOf(r.label, r.count)), 1);
  const mid = Math.floor(maxSeats / 2);

  /** Adds (+1) or removes (-1) one walkway column right before a seat. Seat numbers never change. */
  function changeAisle(row: string, number: number, delta: 1 | -1) {
    const key = `${row}-${number}`;
    setAisles((prev) => {
      const next = { ...prev };
      const n = (next[key] ?? 0) + delta;
      if (n > 0) next[key] = Math.min(n, 4);
      else delete next[key];
      return next;
    });
  }
  const update = (next: RowSpec[]) => setRows(next);

  // Auditorium layout statistics
  const stats = useMemo(() => {
    let active = 0;
    let disabled = 0;
    let custom = 0;
    const byCategory: Record<string, number> = {};

    editable.forEach((r) => {
      for (let i = 1; i <= r.count; i++) {
        const key = `${r.label}-${i}`;
        const override = seatOverrides[key];
        if (override === "inactive") {
          disabled++;
        } else {
          active++;
          const cat = override || r.category;
          byCategory[cat] = (byCategory[cat] ?? 0) + 1;
          if (override && override !== r.category) {
            custom++;
          }
        }
      }
    });

    return { total: active + disabled, active, disabled, custom, byCategory };
  }, [editable, seatOverrides]);

  // Click on a seat in the 3D auditorium grid
  function handleSeatClick(row: string, number: number) {
    const key = `${row}-${number}`;
    const rowDef = editable.find((x) => x.label === row)?.category ?? "standard";

    if (activeTool === "select") {
      setSelectedSeat((prev) => (prev?.row === row && prev?.number === number ? null : { row, number }));
    } else if (activeTool === "aisle") {
      changeAisle(row, number, 1);
    } else if (activeTool === "inactive") {
      setSeatOverrides((prev) => {
        const next = { ...prev };
        if (next[key] === "inactive") {
          delete next[key];
        } else {
          next[key] = "inactive";
        }
        return next;
      });
      setSelectedSeat({ row, number });
    } else {
      // activeTool is a category key (e.g. "premium", "lounge")
      setSeatOverrides((prev) => {
        const next = { ...prev };
        if (next[key] === activeTool) {
          delete next[key]; // toggle back to row default
        } else if (activeTool === rowDef) {
          delete next[key]; // same as row default
        } else {
          next[key] = activeTool;
        }
        return next;
      });
      setSelectedSeat({ row, number });
    }
  }

  // Set category for specific seat
  function setSeatCategory(row: string, number: number, categoryKey: string) {
    const key = `${row}-${number}`;
    const rowDef = editable.find((x) => x.label === row)?.category ?? "standard";
    setSeatOverrides((prev) => {
      const next = { ...prev };
      if (categoryKey === rowDef) {
        delete next[key];
      } else {
        next[key] = categoryKey;
      }
      return next;
    });
  }

  // Toggle inactive / gap for specific seat
  function toggleSeatInactive(row: string, number: number) {
    const key = `${row}-${number}`;
    setSeatOverrides((prev) => {
      const next = { ...prev };
      if (next[key] === "inactive") {
        delete next[key];
      } else {
        next[key] = "inactive";
      }
      return next;
    });
  }

  // Reset a single seat's override back to row default
  function resetSeatOverride(row: string, number: number) {
    const key = `${row}-${number}`;
    setSeatOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function save() {
    const seats: { row_label: string; number: number; category_key: string; x: number; y: number }[] = [];
    editable.forEach((r, y) => {
      for (let i = 1; i <= r.count; i++) {
        const key = `${r.label}-${i}`;
        const override = seatOverrides[key];
        if (override === "inactive") {
          continue; // Inactive / gap seats are omitted and handled by the backend
        }
        const category_key = override || r.category;
        seats.push({
          row_label: r.label,
          number: i,
          category_key,
          x: colOf(r.label, i),
          y,
        });
      }
    });

    if (seats.length === 0) {
      act.run(async () => {}, "Auditorium must have at least 1 active seat.");
      return;
    }

    const r = await act.run(
      () =>
        adm.put<{ created: number; updated: number; removed: number; deactivated: number }>(
          `/rooms/${room.id}/seats`,
          { seats },
        ),
      undefined,
    );
    if (r) {
      const d = r.data;
      act.run(
        async () => d,
        `Saved layout: ${d.created} added, ${d.updated} updated, ${d.removed} removed, ${d.deactivated} deactivated.`,
      );
      current.reload();
      setRows(null);
      setSeatOverrides({});
      setAisles({});
      setSyncedRoomId(null);
      setSelectedSeat(null);
    }
  }

  // Inspector seat information
  const selectedSeatKey = selectedSeat ? `${selectedSeat.row}-${selectedSeat.number}` : null;
  const selectedSeatRow = selectedSeat ? editable.find((x) => x.label === selectedSeat.row) : null;
  const selectedSeatOverride = selectedSeatKey ? seatOverrides[selectedSeatKey] : undefined;
  const isSelectedSeatInactive = selectedSeatOverride === "inactive";
  const selectedEffectiveCat = selectedSeatOverride && selectedSeatOverride !== "inactive"
    ? selectedSeatOverride
    : (selectedSeatRow?.category ?? "standard");
  const isSelectedSeatCustom = !!selectedSeatOverride;

  return (
    <div>
      <PageTitle
        title={`Seat Layout: ${room.name}`}
        hint="Configure rows, capacities, and customize individual seats with live ticket booking preview"
        breadcrumbs={[{ label: "Cinemas", href: "/admin/cinemas" }, { label: cinemaName }, { label: room.name }]}
        action={<Button variant="secondary" onClick={() => router.push("/admin/cinemas")}><ArrowLeft className="size-4" aria-hidden /> Back to cinemas</Button>}
      />
      <Feedback error={act.error} note={act.note} />
      <Section loading={current.loading || cats.loading} error={current.error ?? cats.error} data={cats.data}>
        {(categories) => (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Row Configuration Form (Matches Image 1) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface/60 px-4 py-2.5">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Auditorium Capacity</span>
                  <p className="text-[11px] text-muted">
                    {stats.active} active seats · {editable.length} rows
                    {stats.disabled > 0 ? ` · ${stats.disabled} disabled / gaps` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-accent">{stats.active} seats</span>
                  {stats.custom > 0 ? (
                    <p className="text-[10px] font-semibold text-accent-text">{stats.custom} custom overrides</p>
                  ) : null}
                </div>
              </div>

              {/* Scrollable Rows Table */}
              <div className="max-h-[50vh] overflow-y-auto pr-1">
                <ul className="grid gap-2">
                  {editable.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-xl border border-line/70 bg-surface/40 p-2 shadow-xs transition hover:border-line">
                      <div className="w-12">
                        <input
                          aria-label={`Row ${i + 1} letter`}
                          value={r.label}
                          maxLength={2}
                          onChange={(e) => update(editable.map((x, j) => (j === i ? { ...x, label: e.target.value.toUpperCase() } : x)))}
                          className="h-10 w-full rounded-lg border border-line bg-background text-center font-bold text-foreground outline-none focus:border-accent uppercase"
                        />
                      </div>
                      <div className="w-20">
                        <input
                          aria-label={`Row ${r.label} seats`}
                          type="number"
                          min={1}
                          max={40}
                          value={r.count}
                          onChange={(e) => update(editable.map((x, j) => (j === i ? { ...x, count: Math.max(1, Math.min(40, Number(e.target.value) || 1)) } : x)))}
                          className="h-10 w-full rounded-lg border border-line bg-background text-center font-semibold text-foreground outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <select
                          aria-label={`Row ${r.label} category`}
                          value={r.category}
                          onChange={(e) => update(editable.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                          className="h-10 w-full rounded-lg border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent cursor-pointer"
                        >
                          {categories.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove row ${r.label}`}
                        className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                        onClick={() => update(editable.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/50">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={editable.length >= 26}
                  onClick={() =>
                    update([
                      ...editable,
                      {
                        label: String.fromCharCode(65 + editable.length),
                        count: editable.at(-1)?.count ?? 14,
                        category: editable.at(-1)?.category ?? categories[0]?.key ?? "standard",
                      },
                    ])
                  }
                >
                  <Plus className="size-4" />
                  <span>Add row</span>
                </Button>

                <Button onClick={save} disabled={act.busy || stats.active === 0}>
                  {act.busy ? "Saving…" : "Save layout"}
                </Button>
              </div>

              <div className="rounded-xl border border-line/50 bg-surface/30 p-3 text-xs text-muted leading-relaxed">
                <p className="font-semibold text-foreground mb-1">💡 Manual Per-Seat Customization:</p>
                <p>
                  Click any seat on the visual preview to customize its tier or disable it (wheelchair space or broken seat; its number stays reserved). To add a walkway between two seats without skipping any seat number, use the Walkway Brush or the &quot;Walkway before&quot; button.
                </p>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Seats already used by a showtime are never deleted: if you remove them they are kept but switched off, and their category cannot change.
              </p>
            </div>

            {/* Right Column: Live Ticket Booking Visual Map (Matches Image 2 & supports manual editing) */}
            <div className="lg:col-span-7">
              <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-accent/10 via-surface to-surface px-3 pb-8 pt-5 sm:px-6 shadow-inner">
                {/* Header: Legend & View Stats */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">Tiers:</span>
                    {categories.map((c) => (
                      <span
                        key={c.key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated px-2.5 py-1 text-xs text-foreground font-medium shadow-xs"
                      >
                        <span className={cn("size-3 rounded-t-sm border", styleFor(c.key))} />
                        <span>{c.name}</span>
                        <span className="text-[10px] text-muted">({stats.byCategory[c.key] ?? 0})</span>
                      </span>
                    ))}
                    {stats.disabled > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-elevated px-2.5 py-1 text-xs text-muted font-medium shadow-xs">
                        <span className="size-3 rounded-t-sm border border-dashed border-line/60 bg-foreground/5 text-[8px] flex items-center justify-center">✕</span>
                        <span>Disabled</span>
                        <span className="text-[10px]">({stats.disabled})</span>
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[11px] font-semibold text-accent">
                    {stats.active} of {stats.total} seats bookable
                  </span>
                </div>

                {/* Interactive Tool Palette */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-surface/70 p-2 text-xs backdrop-blur-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted px-1">Tool:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTool("select")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                        activeTool === "select"
                          ? "border-accent bg-accent/15 text-accent shadow-xs"
                          : "border-line/60 bg-elevated/60 text-muted hover:text-foreground hover:border-line"
                      )}
                    >
                      <MousePointerClick className="size-3.5" />
                      <span>Select & Edit</span>
                    </button>

                    {categories.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setActiveTool(c.key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                          activeTool === c.key
                            ? "border-accent bg-accent/15 text-accent shadow-xs"
                            : "border-line/60 bg-elevated/60 text-muted hover:text-foreground hover:border-line"
                        )}
                      >
                        <Paintbrush className="size-3.5" />
                        <span>Paint {c.name}</span>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setActiveTool("inactive")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                        activeTool === "inactive"
                          ? "border-rose-500 bg-rose-500/15 text-rose-500 shadow-xs"
                          : "border-line/60 bg-elevated/60 text-muted hover:text-foreground hover:border-line"
                      )}
                    >
                      <Ban className="size-3.5" />
                      <span>Disable Brush</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTool("aisle")}
                      title="Click a seat to add a walkway before it (the seat moves right). Click a blue walkway cell to remove it. Seat numbers stay unchanged."
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                        activeTool === "aisle"
                          ? "border-sky-500 bg-sky-500/15 text-sky-500 shadow-xs"
                          : "border-line/60 bg-elevated/60 text-muted hover:text-foreground hover:border-line"
                      )}
                    >
                      <span aria-hidden>⇄</span>
                      <span>Walkway Brush</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {stats.custom > 0 || stats.disabled > 0 || Object.keys(aisles).length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSeatOverrides({});
                          setAisles({});
                          setSelectedSeat(null);
                        }}
                        title="Reset all individual seat overrides back to row defaults"
                        className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-elevated/60 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:border-line transition cursor-pointer"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Reset overrides ({stats.custom + stats.disabled + Object.keys(aisles).length})</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-pressed={view3d}
                      onClick={() => setView3d((v) => !v)}
                      className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-elevated/80 px-2.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition hover:border-accent cursor-pointer"
                    >
                      <Box className="size-3.5 text-accent" aria-hidden />
                      <span>{view3d ? "3D view" : "Flat view"}</span>
                    </button>
                  </div>
                </div>

                {/* Floating Seat Inspector Banner (when a seat is selected) */}
                {selectedSeat && selectedSeatRow ? (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-3 sm:px-4 shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-contrast font-bold text-sm shadow-xs">
                        {selectedSeat.row}{selectedSeat.number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            Seat {selectedSeat.row}-{selectedSeat.number}
                          </span>
                          {isSelectedSeatInactive ? (
                            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                              Disabled / Gap
                            </span>
                          ) : isSelectedSeatCustom ? (
                            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-text">
                              Custom override
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted">
                              Row default ({selectedSeatRow.category})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted">
                          {isSelectedSeatInactive
                            ? "Disabled: omitted from live booking inventory"
                            : `Tier: ${Array.isArray(categories) ? (categories.find((c) => c.key === selectedEffectiveCat)?.name ?? selectedEffectiveCat) : selectedEffectiveCat}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted mr-1">Set tier:</span>
                      {categories.map((c) => {
                        const isCurrent = !isSelectedSeatInactive && selectedEffectiveCat === c.key;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setSeatCategory(selectedSeat.row, selectedSeat.number, c.key)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                              isCurrent
                                ? "border-accent bg-accent text-accent-contrast shadow-xs"
                                : "border-line bg-surface hover:border-accent hover:text-foreground text-muted"
                            )}
                          >
                            <span className={cn("size-2 rounded-full", catStyle[c.key.toLowerCase()] ?? "bg-foreground")} />
                            <span>{c.name}</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => toggleSeatInactive(selectedSeat.row, selectedSeat.number)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                          isSelectedSeatInactive
                            ? "border-rose-500 bg-rose-500 text-white shadow-xs"
                            : "border-line bg-surface hover:border-rose-400 hover:text-rose-500 text-muted"
                        )}
                      >
                        <Ban className="size-3" />
                        <span>{isSelectedSeatInactive ? "Disabled" : "Disable"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => changeAisle(selectedSeat.row, selectedSeat.number, 1)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                          (aisles[selectedSeatKey ?? ""] ?? 0) > 0
                            ? "border-sky-500 bg-sky-500 text-white shadow-xs"
                            : "border-line bg-surface hover:border-sky-400 hover:text-sky-500 text-muted"
                        )}
                      >
                        <span aria-hidden>⇄</span>
                        <span>Walkway before{(aisles[selectedSeatKey ?? ""] ?? 0) > 0 ? ` (${aisles[selectedSeatKey ?? ""]})` : ""}</span>
                      </button>
                      {(aisles[selectedSeatKey ?? ""] ?? 0) > 0 ? (
                        <button
                          type="button"
                          aria-label="Remove one walkway before this seat"
                          onClick={() => changeAisle(selectedSeat.row, selectedSeat.number, -1)}
                          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-muted transition hover:border-sky-400 hover:text-sky-500 cursor-pointer"
                        >
                          −
                        </button>
                      ) : null}

                      {isSelectedSeatCustom ? (
                        <button
                          type="button"
                          onClick={() => resetSeatOverride(selectedSeat.row, selectedSeat.number)}
                          title="Reset seat to row default"
                          className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground hover:border-line transition cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                          <span>Reset</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setSelectedSeat(null)}
                        aria-label="Close inspector"
                        className="ml-1 rounded-lg p-1 text-muted hover:text-foreground hover:bg-surface transition cursor-pointer"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* 3D Curved Perspective Screen & Seats Container */}
                <div className="mx-auto mt-2 w-full max-w-2xl overflow-x-auto px-5 pb-4 sm:px-8 scrollbar-none" style={{ perspective: "1100px" }}>
                  <div aria-hidden className="relative mx-auto mb-7 w-[88%]">
                    <div className="h-10 rounded-[50%] border-t-[3px] border-accent shadow-[0_-12px_40px_-6px_var(--accent)]" />
                    <div className="pointer-events-none absolute inset-x-6 top-3 h-24 bg-gradient-to-b from-accent/25 to-transparent [clip-path:polygon(0_0,100%_0,100%_40%,92%_100%,8%_100%,0_40%)]" />
                    <p className="relative mt-3 text-center text-[0.65rem] uppercase tracking-[0.6em] text-muted font-bold">
                      S C R E E N
                    </p>
                  </div>

                  <div
                    role="group"
                    aria-label="Seats"
                    className="flex flex-col gap-1.5 transition-transform duration-700 ease-out sm:gap-2 min-w-[320px]"
                    style={{
                      transform: view3d ? "rotateX(14deg)" : "none",
                      transformOrigin: "50% 0%",
                    }}
                  >
                    {editable.map((r) => {
                      // Map grid column -> seat number, and mark the empty column after a seat that has a walkway.
                      const seatAt = new Map<number, number>();
                      const walkAt = new Map<number, number>();
                      for (let n = 1; n <= r.count; n++) {
                        const c = colOf(r.label, n);
                        seatAt.set(c, n);
                        for (let k = 1; k <= (aisles[`${r.label}-${n}`] ?? 0); k++) walkAt.set(c - k, n);
                      }
                      const track = (c: number) => (c <= mid ? c + 1 : c + 2);

                      return (
                        <div
                          key={r.label}
                          className="grid items-center gap-x-1 sm:gap-x-1.5"
                          style={{
                            gridTemplateColumns: `1.25rem repeat(${mid}, minmax(0, 1fr)) 1.5rem repeat(${maxSeats - mid}, minmax(0, 1fr)) 1.25rem`,
                          }}
                        >
                          <span aria-hidden className="text-center text-[0.65rem] font-bold text-muted select-none" style={{ gridColumnStart: 1 }}>
                            {r.label}
                          </span>

                          {Array.from({ length: maxSeats }, (_, ci) => {
                            const c = ci + 1;
                            const seatNum = seatAt.get(c);
                            const walkAfter = walkAt.get(c);

                            if (seatNum === undefined && walkAfter !== undefined) {
                              return (
                                <button
                                  key={`walk-${c}`}
                                  type="button"
                                  title={`Walkway before seat ${walkAfter}: click to remove`}
                                  aria-label={`Remove walkway before row ${r.label} seat ${walkAfter}`}
                                  onClick={() => changeAisle(r.label, walkAfter, -1)}
                                  style={{ gridColumnStart: track(c) }}
                                  className="grid aspect-square w-full max-w-10 cursor-pointer place-items-center rounded-md border border-dashed border-sky-400/50 bg-sky-400/10 text-[0.5rem] font-bold text-sky-500 outline-none hover:bg-sky-400/25"
                                >
                                  ⇄
                                </button>
                              );
                            }
                            if (seatNum === undefined) {
                              return (
                                <div
                                  key={`empty-${c}`}
                                  style={{ gridColumnStart: track(c) }}
                                  className="grid aspect-square w-full max-w-10 place-items-center rounded-t-lg rounded-b-[0.3rem] border border-dashed border-line/25 bg-foreground/[0.02] opacity-25"
                                />
                              );
                            }

                            const seatKey = `${r.label}-${seatNum}`;
                            const override = seatOverrides[seatKey];
                            const isInactive = override === "inactive";
                            const isCustomTier = !!override && override !== "inactive" && override !== r.category;
                            const effectiveCat = isInactive ? null : (override || r.category);
                            const catClass = effectiveCat ? (catStyle[effectiveCat.toLowerCase()] ?? fallbackStyle) : "";
                            const catName = isInactive ? "Disabled (Gap)" : ((Array.isArray(categories) ? categories.find((k) => k.key === effectiveCat)?.name : null) ?? effectiveCat);
                            const isSelected = selectedSeat?.row === r.label && selectedSeat?.number === seatNum;
                            const hasWalkway = (aisles[seatKey] ?? 0) > 0;

                            return (
                              <button
                                key={seatNum}
                                type="button"
                                onClick={() => handleSeatClick(r.label, seatNum)}
                                style={{ gridColumnStart: track(c) }}
                                title={`Row ${r.label}, Seat ${seatNum} · ${catName}${isCustomTier ? " (Custom override)" : ""}${isInactive ? " (Disabled / Gap)" : ""}${hasWalkway ? " · walkway before" : ""}`}
                                aria-label={`Row ${r.label}, Seat ${seatNum}, ${catName}`}
                                className={cn(
                                  "relative grid aspect-square w-full max-w-10 place-items-center rounded-t-lg rounded-b-[0.3rem] text-[0.6rem] font-semibold transition duration-150 sm:text-xs select-none cursor-pointer outline-none",
                                  isInactive
                                    ? "border border-dashed border-line/60 bg-foreground/[0.03] text-muted/40 hover:border-line hover:bg-foreground/[0.08]"
                                    : cn("border-b-[3px]", catClass),
                                  isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-background scale-110 z-10 shadow-lg",
                                  !isSelected && "hover:-translate-y-0.5",
                                )}
                              >
                                {(isCustomTier || isInactive) && (
                                  <span className={cn("absolute top-0.5 right-0.5 size-1.5 rounded-full", isInactive ? "bg-rose-400" : "bg-accent")} aria-hidden />
                                )}
                                {/* Disabled seats keep their number visible so numbering never looks like it skips */}
                                <span className={isInactive ? "opacity-50 line-through" : undefined}>{seatNum}</span>
                              </button>
                            );
                          })}

                          <span aria-hidden className="text-center text-[0.65rem] font-bold text-muted select-none" style={{ gridColumnStart: maxSeats + 3 }}>
                            {r.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
