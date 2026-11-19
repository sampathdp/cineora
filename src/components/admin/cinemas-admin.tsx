"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair, Edit2, Plus } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Panel, Pill, Section, TextArea, TextField, useAction, useLoad } from "./kit";
import { routes } from "@/lib/routes";

interface Room { id: string; name: string; screen_type: string; is_active: boolean; seat_count: number | null }
interface Cinema {
  id: string; slug: string; name: string; area: string | null; address: string; phone: string | null; email: string | null; description: string | null;
  timezone: string; is_active: boolean; facilities: string[]; images: { id: number; url: string; alt: string | null }[]; rooms: Room[];
}

export function CinemasAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const router = useRouter();
  const openLayout = (room: Room) => router.push(routes.roomSeats(room.id));
  const [roomPickerFor, setRoomPickerFor] = useState<Cinema | null>(null);
  const open = (id: string | null) => { setCreatedId(null); setEditing(id); };
  const list = useLoad(() => adm.get<Cinema[]>("/cinemas").then((r) => r.data), "cinemas");
  const selected = Array.isArray(list.data) ? (list.data.find((c) => c.id === editing) ?? null) : null;

  return (
    <section>
      <PageTitle
        title="Cinemas & Screening Rooms"
        eyebrow="Cinema Operations"
        hint="Venues, screening halls, facilities, and dynamic seat grid layout configurations."
        action={can("cinemas.manage") && can("settings.manage") ? <Button onClick={() => open("new")}><Plus className="size-4" aria-hidden /> New cinema</Button> : undefined}
      />
      <Feedback error={act.error} note={act.note} />
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable rows={rows} rowKey={(c) => c.id} onRowClick={(c) => open(c.id)} empty="You are not assigned to any cinema yet."
            columns={[
              { key: "n", label: "Name", render: (c) => <button className="font-semibold hover:text-accent-text" onClick={() => open(c.id)}>{c.name}</button> },
              { key: "a", label: "Address", render: (c) => c.address },
              { key: "r", label: "Rooms", render: (c) => c.rooms.length },
              { key: "s", label: "Status", render: (c) => <Pill tone={c.is_active ? "good" : "neutral"}>{c.is_active ? "Open" : "Closed"}</Pill> },
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
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
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
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer border-accent/40 text-accent hover:border-accent hover:bg-accent/10"
                    >
                      <Armchair className="size-3.5 mr-1" />
                      <span>Seat layout</span>
                    </Button>

                    {can("cinemas.manage") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await act.run(() => adm.patch(`/cinemas/${c.id}`, { is_active: !c.is_active }), c.is_active ? "Cinema closed." : "Cinema opened.")) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2.5 text-xs text-muted hover:text-foreground cursor-pointer"
                      >
                        {c.is_active ? "Close venue" : "Open venue"}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]} />
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
          title={`Screening Rooms: ${roomPickerFor.name}`}
          subtitle="Select a room to configure its seat layout"
          size="md"
        >
          <div className="grid gap-2.5">
            {roomPickerFor.rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface/50 hover:border-accent transition"
              >
                <div>
                  <h4 className="font-bold text-foreground text-sm sm:text-base">{r.name}</h4>
                  <p className="text-xs text-muted">
                    {r.screen_type} · {r.seat_count ?? 0} seats
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRoomPickerFor(null);
                    openLayout(r);
                  }}
                  className="cursor-pointer"
                >
                  <Armchair className="size-3.5 mr-1" />
                  <span>Configure layout</span>
                </Button>
              </div>
            ))}
          </div>
        </AdminModal>
      ) : null}
    </section>
  );
}

function CinemaEditor({ cinema, onClose, onSaved }: { cinema: Cinema | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const { can } = useAuth();
  const act = useAction();
  const canEdit = cinema ? can("cinemas.manage") : true;
  const [f, setF] = useState({
    name: cinema?.name ?? "", area: cinema?.area ?? "", address: cinema?.address ?? "", phone: cinema?.phone ?? "", email: cinema?.email ?? "",
    description: cinema?.description ?? "", timezone: cinema?.timezone ?? "Asia/Seoul", is_active: cinema?.is_active ?? true, facilities: (cinema?.facilities ?? []).join(", "),
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...f, area: f.area || null, phone: f.phone || null, email: f.email || null, description: f.description || null, facilities: f.facilities.split(",").map((s) => s.trim()).filter(Boolean) };
    const r = await act.run(() => (cinema ? adm.patch<Cinema>(`/cinemas/${cinema.id}`, body) : adm.post<Cinema>("/cinemas", body)), "Saved.");
    if (r) onSaved(r.data.id);
  }

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={cinema ? `Edit: ${cinema.name}` : "New Cinema"}
      subtitle="Cinema details, facilities, screening rooms, and photos"
      size="xl"
    >
      <div className="grid gap-6">
        <form onSubmit={save} noValidate className="grid gap-4" aria-label="Cinema form">
          <Feedback error={act.error} note={act.note} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="c-name" label="Name" value={f.name} onChange={(e) => set("name", e.target.value)} error={act.fields.name} disabled={!canEdit} />
            <TextField id="c-area" label="Area" value={f.area} onChange={(e) => set("area", e.target.value)} disabled={!canEdit} />
            <TextField id="c-addr" label="Address" value={f.address} onChange={(e) => set("address", e.target.value)} error={act.fields.address} disabled={!canEdit} />
            <TextField id="c-tz" label="Time zone" value={f.timezone} onChange={(e) => set("timezone", e.target.value)} error={act.fields.timezone} hint="e.g. Asia/Seoul" disabled={!canEdit} />
            <TextField id="c-phone" label="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} error={act.fields.phone} disabled={!canEdit} />
            <TextField id="c-mail" label="Email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} error={act.fields.email} disabled={!canEdit} />
          </div>
          <TextArea id="c-desc" label="Description" value={f.description} onChange={(e) => set("description", e.target.value)} disabled={!canEdit} />
          <TextField id="c-fac" label="Facilities (comma separated)" value={f.facilities} onChange={(e) => set("facilities", e.target.value)} disabled={!canEdit} />
          <CheckField id="c-active" label="Open for bookings" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} disabled={!canEdit} />
          <div className="flex gap-3">
            {canEdit ? <Button type="submit" disabled={act.busy}>{act.busy ? "Saving…" : "Save"}</Button> : null}
            <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </form>
        {cinema ? <Photos cinema={cinema} onChanged={() => onSaved()} /> : null}
        {cinema ? <Rooms cinema={cinema} onChanged={() => onSaved()} /> : null}
      </div>
    </AdminModal>
  );
}

function Photos({ cinema, onChanged }: { cinema: Cinema; onChanged: () => void }) {
  const { can } = useAuth();
  const act = useAction();
  return (
    <Panel title="Photos">
      <Feedback error={act.error} note={act.note} />
      <ul className="mb-3 flex flex-wrap gap-3">
        {cinema.images.map((i) => (
          <li key={i.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image */}
            <img src={i.url} alt={i.alt ?? "Cinema photo"} className="h-24 rounded-control border border-line object-cover" />
            {can("cinemas.manage") ? <button className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white" aria-label="Remove photo" onClick={async () => { if (window.confirm("Remove this photo?") && (await act.run(() => adm.del(`/cinemas/${cinema.id}/images/${i.id}`)))) onChanged(); }}>✕</button> : null}
          </li>
        ))}
        {cinema.images.length === 0 ? <li className="text-sm text-muted">No photos yet.</li> : null}
      </ul>
      {can("cinemas.manage") ? (
        <>
          <label htmlFor="c-photo" className="inline-flex min-h-10 cursor-pointer items-center rounded-control border border-line px-3 text-sm font-semibold hover:border-accent">Add a photo</label>
          <input id="c-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file && (await act.run(() => adm.upload(`/cinemas/${cinema.id}/images`, file), "Photo added."))) onChanged(); }} />
        </>
      ) : null}
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
    <Panel title="Screening rooms">
      <Feedback error={act.error} note={act.note} />
      <DataTable rows={cinema.rooms} rowKey={(r) => r.id} empty="No rooms yet."
        columns={[
          { key: "n", label: "Room", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "t", label: "Type", render: (r) => r.screen_type },
          { key: "s", label: "Seats", render: (r) => r.seat_count ?? 0 },
          { key: "a", label: "Status", render: (r) => <Pill tone={r.is_active ? "good" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Pill> },
          { key: "x", label: "", render: (r) => canManage ? (
            <span className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => router.push(routes.roomSeats(r.id))}>Seat layout</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (await act.run(() => adm.patch(`/rooms/${r.id}`, { is_active: !r.is_active }))) onChanged(); }}>{r.is_active ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm(`Delete room ${r.name}?`) && (await act.run(() => adm.del(`/rooms/${r.id}`), "Room deleted."))) onChanged(); }}>Delete</Button>
            </span>
          ) : null },
        ]} />
      {canManage ? (
        <form className="mt-4 flex flex-wrap items-end gap-3" aria-label="Add room" onSubmit={async (e) => { e.preventDefault(); if (await act.run(() => adm.post(`/cinemas/${cinema.id}/rooms`, { name, screen_type: "Standard" }), "Room added.")) { setName(""); onChanged(); } }}>
          <div className="min-w-48 flex-1"><TextField id="room-name" label="New room name" value={name} onChange={(e) => setName(e.target.value)} error={act.fields.name} /></div>
          <Button type="submit" disabled={act.busy || !name.trim()}>Add room</Button>
        </form>
      ) : null}
    </Panel>
  );
}
