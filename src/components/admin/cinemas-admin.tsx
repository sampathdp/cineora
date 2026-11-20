"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair, Building2, Edit2, MapPin, Phone, Plus, Sparkles, Trash2, Video } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Panel, Pill, Section, TextArea, TextField, useAction, useLoad } from "./kit";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  screen_type: string;
  is_active: boolean;
  seat_count: number | null;
}

interface Cinema {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  timezone: string;
  is_active: boolean;
  facilities: string[];
  images: { id: number; url: string; alt: string | null }[];
  rooms: Room[];
}

export function CinemasAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const router = useRouter();
  const openLayout = (room: Room) => router.push(routes.roomSeats(room.id));
  const [roomPickerFor, setRoomPickerFor] = useState<Cinema | null>(null);

  const open = (id: string | null) => {
    setCreatedId(null);
    setEditing(id);
  };

  const list = useLoad(() => adm.get<Cinema[]>("/cinemas").then((r) => r.data), "cinemas");
  const selected = Array.isArray(list.data) ? (list.data.find((c) => c.id === editing) ?? null) : null;

  return (
    <section className="space-y-6">
      <PageTitle
        title="Cinemas & Screening Halls"
        eyebrow="Cinema Operations"
        icon={Building2}
        hint="Manage multiplex venues, screening halls, facilities, and dynamic seat layout grid configurations."
        action={
          can("cinemas.manage") && can("settings.manage") ? (
            <Button onClick={() => open("new")} className="shadow-sm">
              <Plus className="size-4 mr-1.5" aria-hidden />
              <span>New cinema venue</span>
            </Button>
          ) : undefined
        }
      />

      <Feedback error={act.error} note={act.note} />

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => open(c.id)}
            empty="You are not assigned to any cinema yet."
            columns={[
              {
                key: "n",
                label: "Cinema Venue",
                render: (c) => (
                  <div>
                    <button
                      className="text-left font-bold text-foreground hover:text-accent transition cursor-pointer"
                      onClick={() => open(c.id)}
                    >
                      {c.name}
                    </button>
                    {c.area && (
                      <span className="block text-xs text-muted font-medium mt-0.5">
                        {c.area}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "a",
                label: "Address & Contact",
                render: (c) => (
                  <div className="max-w-xs text-xs">
                    <p className="truncate text-foreground/90">{c.address}</p>
                    {c.phone && <p className="text-muted mt-0.5">{c.phone}</p>}
                  </div>
                ),
              },
              {
                key: "f",
                label: "Facilities",
                render: (c) => (
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {c.facilities.slice(0, 3).map((f) => (
                      <span
                        key={f}
                        className="rounded-full border border-line/60 bg-surface/60 px-2 py-0.5 text-[10px] text-muted font-medium"
                      >
                        {f}
                      </span>
                    ))}
                    {c.facilities.length > 3 && (
                      <span className="text-[10px] text-muted self-center">
                        +{c.facilities.length - 3}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "r",
                label: "Halls",
                render: (c) => (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/70 px-2.5 py-1 text-xs font-semibold text-foreground">
                    <Video className="size-3 text-accent" />
                    <span>{c.rooms.length} Halls</span>
                  </span>
                ),
              },
              {
                key: "s",
                label: "Status",
                render: (c) => (
                  <Pill tone={c.is_active ? "good" : "neutral"}>
                    {c.is_active ? "Open" : "Closed"}
                  </Pill>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (c) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => open(c.id)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (c.rooms.length === 1) {
                          openLayout(c.rooms[0]);
                        } else if (c.rooms.length > 1) {
                          setRoomPickerFor(c);
                        } else {
                          open(c.id);
                        }
                      }}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer border-accent/40 text-accent hover:border-accent hover:bg-accent/10 shadow-sm"
                    >
                      <Armchair className="size-3.5 mr-1" />
                      <span>Seat Layout</span>
                    </Button>

                    {can("cinemas.manage") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (
                            await act.run(
                              () => adm.patch(`/cinemas/${c.id}`, { is_active: !c.is_active }),
                              c.is_active ? "Cinema closed." : "Cinema opened.",
                            )
                          ) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2 text-xs text-muted hover:text-foreground cursor-pointer"
                      >
                        {c.is_active ? "Close" : "Open"}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Section>

      {editing ? (
        <CinemaEditor
          key={editing === "new" || editing === createdId ? "created" : editing}
          cinema={editing === "new" ? null : selected}
          onClose={() => open(null)}
          onSaved={(id) => {
            list.reload();
            if (id) {
              setCreatedId(id);
              setEditing(id);
            }
          }}
        />
      ) : null}

      {roomPickerFor ? (
        <AdminModal
          open={true}
          onClose={() => setRoomPickerFor(null)}
          title={`Screening Halls: ${roomPickerFor.name}`}
          subtitle="Select a room to launch the interactive seat layout designer"
          size="md"
        >
          <div className="grid gap-3">
            {roomPickerFor.rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-line/70 bg-surface/50 hover:border-accent/60 transition shadow-sm backdrop-blur-sm"
              >
                <div>
                  <h4 className="font-bold text-foreground text-sm sm:text-base">{r.name}</h4>
                  <p className="text-xs text-muted mt-0.5">
                    {r.screen_type} Screen · <strong className="text-foreground">{r.seat_count ?? 0}</strong> seats
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRoomPickerFor(null);
                    openLayout(r);
                  }}
                  className="cursor-pointer shadow-sm"
                >
                  <Armchair className="size-3.5 mr-1.5" />
                  <span>Edit Layout</span>
                </Button>
              </div>
            ))}
          </div>
        </AdminModal>
      ) : null}
    </section>
  );
}

function CinemaEditor({
  cinema,
  onClose,
  onSaved,
}: {
  cinema: Cinema | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const { can } = useAuth();
  const act = useAction();
  const canEdit = cinema ? can("cinemas.manage") : true;
  const [f, setF] = useState({
    name: cinema?.name ?? "",
    area: cinema?.area ?? "",
    address: cinema?.address ?? "",
    phone: cinema?.phone ?? "",
    email: cinema?.email ?? "",
    description: cinema?.description ?? "",
    timezone: cinema?.timezone ?? "Asia/Seoul",
    is_active: cinema?.is_active ?? true,
    facilities: (cinema?.facilities ?? []).join(", "),
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...f,
      area: f.area || null,
      phone: f.phone || null,
      email: f.email || null,
      description: f.description || null,
      facilities: f.facilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const r = await act.run(
      () => (cinema ? adm.patch<Cinema>(`/cinemas/${cinema.id}`, body) : adm.post<Cinema>("/cinemas", body)),
      "Saved.",
    );
    if (r) onSaved(r.data.id);
  }

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={cinema ? `Edit: ${cinema.name}` : "New Cinema Complex"}
      subtitle="Venue location, operating status, screening halls, and gallery photos"
      size="xl"
    >
      <div className="space-y-6">
        <form onSubmit={save} noValidate className="space-y-5" aria-label="Cinema form">
          <Feedback error={act.error} note={act.note} />

          <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <Building2 className="size-3.5 text-accent" />
              <span>Venue Profile & Contact</span>
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="c-name"
                label="Cinema Name"
                placeholder="e.g. Cineora Gangnam Mega Hall"
                value={f.name}
                onChange={(e) => set("name", e.target.value)}
                error={act.fields.name}
                disabled={!canEdit}
              />
              <TextField
                id="c-area"
                label="District / City"
                placeholder="e.g. Gangnam, Seoul"
                value={f.area}
                onChange={(e) => set("area", e.target.value)}
                disabled={!canEdit}
              />
              <TextField
                id="c-addr"
                label="Full Address"
                value={f.address}
                onChange={(e) => set("address", e.target.value)}
                error={act.fields.address}
                disabled={!canEdit}
              />
              <TextField
                id="c-tz"
                label="Time Zone"
                value={f.timezone}
                onChange={(e) => set("timezone", e.target.value)}
                error={act.fields.timezone}
                hint="Default: Asia/Seoul"
                disabled={!canEdit}
              />
              <TextField
                id="c-phone"
                label="Telephone"
                value={f.phone}
                onChange={(e) => set("phone", e.target.value)}
                error={act.fields.phone}
                disabled={!canEdit}
              />
              <TextField
                id="c-mail"
                label="Contact Email"
                type="email"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
                error={act.fields.email}
                disabled={!canEdit}
              />
            </div>

            <TextArea
              id="c-desc"
              label="Venue Synopsis / Description"
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={!canEdit}
            />

            <TextField
              id="c-fac"
              label="Facilities (comma-separated)"
              placeholder="e.g. IMAX, Dolby Atmos, VIP Lounge, Parking, 4DX"
              value={f.facilities}
              onChange={(e) => set("facilities", e.target.value)}
              disabled={!canEdit}
            />

            <div className="pt-1">
              <CheckField
                id="c-active"
                label="Open for public ticket bookings"
                checked={f.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-line/60 pt-4">
            {canEdit && (
              <Button type="submit" disabled={act.busy} className="shadow-sm">
                {act.busy ? "Saving…" : "Save Venue"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
              Close
            </Button>
          </div>
        </form>

        {cinema && (
          <div className="space-y-6 pt-2">
            <Photos cinema={cinema} onChanged={() => onSaved()} />
            <Rooms cinema={cinema} onChanged={() => onSaved()} />
          </div>
        )}
      </div>
    </AdminModal>
  );
}

function Photos({ cinema, onChanged }: { cinema: Cinema; onChanged: () => void }) {
  const { can } = useAuth();
  const act = useAction();
  return (
    <Panel title="Venue Photos & Gallery">
      <Feedback error={act.error} note={act.note} />
      <ul className="mb-4 flex flex-wrap gap-3">
        {cinema.images.map((i) => (
          <li key={i.id} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={i.url}
              alt={i.alt ?? "Cinema photo"}
              className="h-28 w-40 rounded-xl border border-line/70 object-cover shadow-sm transition group-hover:border-accent"
            />
            {can("cinemas.manage") && (
              <button
                className="absolute right-1.5 top-1.5 rounded-lg bg-black/80 p-1 text-xs text-white opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition cursor-pointer"
                aria-label="Remove photo"
                onClick={async () => {
                  if (
                    window.confirm("Remove this photo?") &&
                    (await act.run(() => adm.del(`/cinemas/${cinema.id}/images/${i.id}`)))
                  ) {
                    onChanged();
                  }
                }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {cinema.images.length === 0 && (
          <li className="text-xs text-muted italic py-2">No venue gallery photos uploaded yet.</li>
        )}
      </ul>
      {can("cinemas.manage") && (
        <div>
          <label
            htmlFor="c-photo"
            className="inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-line/80 bg-surface px-3.5 text-xs font-semibold hover:border-accent hover:text-accent transition shadow-sm"
          >
            Upload venue photo
          </label>
          <input
            id="c-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (
                file &&
                (await act.run(() => adm.upload(`/cinemas/${cinema.id}/images`, file), "Photo added."))
              ) {
                onChanged();
              }
            }}
          />
        </div>
      )}
    </Panel>
  );
}

function Rooms({ cinema, onChanged }: { cinema: Cinema; onChanged: () => void }) {
  const { can } = useAuth();
  const act = useAction();
  const [name, setName] = useState("");
  const router = useRouter();
  const canManage = can("rooms.manage");

  return (
    <Panel title="Screening Halls & Auditoriums">
      <Feedback error={act.error} note={act.note} />
      <DataTable
        rows={cinema.rooms}
        rowKey={(r) => r.id}
        empty="No screening rooms configured yet."
        columns={[
          {
            key: "n",
            label: "Hall Name",
            render: (r) => <span className="font-bold text-foreground">{r.name}</span>,
          },
          {
            key: "t",
            label: "Projection / Screen",
            render: (r) => (
              <span className="rounded-full border border-line/70 bg-surface/80 px-2.5 py-0.5 text-xs font-medium">
                {r.screen_type}
              </span>
            ),
          },
          {
            key: "s",
            label: "Capacity",
            render: (r) => <span>{r.seat_count ?? 0} seats</span>,
          },
          {
            key: "a",
            label: "Status",
            render: (r) => (
              <Pill tone={r.is_active ? "good" : "neutral"}>
                {r.is_active ? "Active" : "Inactive"}
              </Pill>
            ),
          },
          {
            key: "x",
            label: "Actions",
            className: "text-right",
            render: (r) =>
              canManage ? (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push(routes.roomSeats(r.id))}
                    className="h-8 px-2.5 text-xs font-semibold text-accent border-accent/40 hover:border-accent hover:bg-accent/10"
                  >
                    <Armchair className="size-3.5 mr-1" />
                    <span>Seat Layout</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        await act.run(() =>
                          adm.patch(`/rooms/${r.id}`, { is_active: !r.is_active }),
                        )
                      ) {
                        onChanged();
                      }
                    }}
                    className="h-8 px-2 text-xs text-muted hover:text-foreground"
                  >
                    {r.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        window.confirm(`Delete hall "${r.name}"?`) &&
                        (await act.run(() => adm.del(`/rooms/${r.id}`), "Room deleted."))
                      ) {
                        onChanged();
                      }
                    }}
                    className="h-8 px-2 text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />

      {canManage && (
        <form
          className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line/60 bg-surface/50 p-4"
          aria-label="Add room"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act.run(
                () => adm.post(`/cinemas/${cinema.id}/rooms`, { name, screen_type: "Standard" }),
                "Room added.",
              )
            ) {
              setName("");
              onChanged();
            }
          }}
        >
          <div className="min-w-48 flex-1">
            <TextField
              id="room-name"
              label="Add New Screening Hall"
              placeholder="e.g. Hall 4 - Dolby Atmos Laser"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={act.fields.name}
            />
          </div>
          <Button type="submit" disabled={act.busy || !name.trim()} className="shadow-sm">
            <Plus className="size-4 mr-1.5" />
            <span>Create Hall</span>
          </Button>
        </form>
      )}
    </Panel>
  );
}
