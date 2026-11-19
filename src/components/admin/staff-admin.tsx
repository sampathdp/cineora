"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, Feedback, PageTitle, Panel, Pill, Section, TextField, useAction, useLoad, when } from "./kit";
import { cn } from "@/lib/utils";

interface Staff { id: string; name: string; email: string; is_active: boolean; roles: string[]; mfa_enabled: boolean; last_login_at: string | null; cinemas: { id: string; name: string }[] }
interface RoleRow { key: string; name: string; is_system: boolean; users: number; permissions: string[] }

export function StaffAdmin() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"people" | "roles">("people");
  return (
    <section>
      <PageTitle
        title="Staff & Role Permissions"
        eyebrow="Security & Access Control"
        hint="Manage staff credentials, assigned cinema venues, RBAC permissions, and two-factor authentication."
      />
      <div role="tablist" aria-label="Staff sections" className="mb-6 flex gap-2">
        {([["people", "People"], ["roles", "Roles and permissions"]] as const).filter(([k]) => k === "people" || can("roles.manage")).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold", tab === k ? "border-accent bg-accent text-on-accent" : "border-line hover:border-accent")}>{label}</button>
        ))}
      </div>
      {tab === "people" ? <People /> : <Roles />}
    </section>
  );
}

function People() {
  const { user, can } = useAuth();
  const act = useAction();
  const list = useLoad(() => adm.get<Staff[]>("/staff").then((r) => r.data), "staff");
  const roles = useLoad(() => adm.get<RoleRow[]>("/roles").then((r) => r.data), "roles-list");
  const cinemas = useLoad(() => adm.get<{ id: string; name: string }[]>("/cinemas").then((r) => r.data), "staff-cinemas");
  const [editing, setEditing] = useState<string | null>(null);
  const selected = list.data?.find((s) => s.id === editing) ?? null;

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> Add staff member</Button></div>
      <Feedback error={act.error} note={act.note} />
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable rows={rows} rowKey={(s) => s.id} onRowClick={(s) => setEditing(s.id)} empty="No staff yet."
            columns={[
              { key: "n", label: "Name", render: (s) => <span><strong>{s.name}</strong>{s.id === user?.id ? " (you)" : ""}<span className="block text-xs text-muted">{s.email}</span></span> },
              { key: "r", label: "Roles", render: (s) => s.roles.map((r) => r.replaceAll("_", " ")).join(", ") },
              { key: "c", label: "Cinemas", render: (s) => s.cinemas.map((c) => c.name).join(", ") || "—" },
              { key: "m", label: "2FA", render: (s) => <Pill tone={s.mfa_enabled ? "good" : "warn"}>{s.mfa_enabled ? "on" : "off"}</Pill> },
              { key: "l", label: "Last sign-in", render: (s) => when(s.last_login_at) },
              { key: "a", label: "Status", render: (s) => <Pill tone={s.is_active ? "good" : "bad"}>{s.is_active ? "active" : "disabled"}</Pill> },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (s) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(s.id)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>
                    {s.id !== user?.id && can("roles.manage") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await act.run(() => adm.patch(`/staff/${s.id}`, { is_active: !s.is_active }), s.is_active ? "Account disabled." : "Account activated.")) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2 text-xs text-muted hover:text-foreground cursor-pointer"
                      >
                        {s.is_active ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]} />
        )}
      </Section>
      {editing ? <StaffEditor key={editing} person={editing === "new" ? null : selected} roles={roles.data ?? []} cinemas={cinemas.data ?? []} isSelf={selected?.id === user?.id} canResetMfa={can("roles.manage") || !!user?.roles.includes("super_admin")} onClose={() => setEditing(null)} onSaved={() => { list.reload(); }} /> : null}
    </>
  );
}

function StaffEditor({ person, roles, cinemas, isSelf, canResetMfa, onClose, onSaved }: { person: Staff | null; roles: RoleRow[]; cinemas: { id: string; name: string }[]; isSelf: boolean; canResetMfa: boolean; onClose: () => void; onSaved: () => void }) {
  const act = useAction();
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [chosenRoles, setChosenRoles] = useState<string[]>(person?.roles ?? []);
  const [chosenCinemas, setChosenCinemas] = useState<string[]>(person?.cinemas.map((c) => c.id) ?? []);
  const staffRoles = roles.filter((r) => r.key !== "customer");
  const toggle = (set: (f: (x: string[]) => string[]) => void, v: string) => set((x) => (x.includes(v) ? x.filter((i) => i !== v) : [...x, v]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = person
      ? await act.run(() => adm.patch(`/staff/${person.id}`, { name, ...(isSelf ? {} : { roles: chosenRoles }), cinemas: chosenCinemas }), "Saved.")
      : await act.run(() => adm.post("/staff", { name, email, roles: chosenRoles, cinemas: chosenCinemas }), "Created. They were emailed a link to choose a password.");
    if (r) onSaved();
  }

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={person ? `Edit Staff: ${person.name}` : "Add Staff Member"}
      subtitle="Staff profile, assigned cinema venues, and role permissions"
      size="lg"
    >
      <form onSubmit={save} noValidate className="grid gap-4" aria-label="Staff form">
        <Feedback error={act.error} note={act.note} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="s-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} error={act.fields.name} />
          <TextField id="s-mail" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={act.fields.email} disabled={!!person} />
        </div>
        <fieldset disabled={isSelf}>
          <legend className="mb-1 text-sm font-semibold">Roles {isSelf ? "(you cannot change your own)" : ""}</legend>
          {act.fields.roles ? <p role="alert" className="text-sm text-red-500">{act.fields.roles}</p> : null}
          <div className="flex flex-wrap gap-2">
            {staffRoles.map((r) => (
              <label key={r.key} className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm", chosenRoles.includes(r.key) ? "border-accent bg-accent/15" : "border-line")} title={r.permissions.join(", ")}>
                <input type="checkbox" className="sr-only" checked={chosenRoles.includes(r.key)} onChange={() => toggle(setChosenRoles, r.key)} />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Cinemas they work at</legend>
          <div className="flex flex-wrap gap-2">
            {cinemas.map((c) => (
              <label key={c.id} className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm", chosenCinemas.includes(c.id) ? "border-accent bg-accent/15" : "border-line")}>
                <input type="checkbox" className="sr-only" checked={chosenCinemas.includes(c.id)} onChange={() => toggle(setChosenCinemas, c.id)} />
                {c.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Cinema-level permissions only apply at the cinemas ticked here.</p>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={act.busy || !name || chosenRoles.length === 0}>{act.busy ? "Saving…" : "Save"}</Button>
          {person && !isSelf ? <Button type="button" variant="secondary" disabled={act.busy} onClick={async () => { if (window.confirm(person.is_active ? "Disable this account and sign them out everywhere?" : "Re-enable this account?") && (await act.run(() => adm.patch(`/staff/${person.id}`, { is_active: !person.is_active }), person.is_active ? "Account disabled." : "Account enabled."))) onSaved(); }}>{person.is_active ? "Disable account" : "Enable account"}</Button> : null}
          {person && !isSelf && canResetMfa ? <Button type="button" variant="ghost" disabled={act.busy} onClick={async () => { if (window.confirm("Reset their two-factor setup? They must enrol again.") && (await act.run(() => adm.post(`/staff/${person.id}/reset-mfa`), "Two-factor reset."))) onSaved(); }}>Reset two-factor</Button> : null}
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </form>
    </AdminModal>
  );
}

function Roles() {
  const roles = useLoad(() => adm.get<RoleRow[]>("/roles").then((r) => r.data), "roles-admin");
  const perms = useLoad(() => adm.get<Record<string, string[]>>("/permissions").then((r) => r.data), "perms");
  const act = useAction();
  const [editing, setEditing] = useState<RoleRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  function open(r: RoleRow | "new") {
    setEditing(r);
    setName(r === "new" ? "" : r.name);
    setChosen(r === "new" ? [] : r.permissions);
  }

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => open("new")}><Plus className="size-4" aria-hidden /> New role</Button></div>
      <Section loading={roles.loading} error={roles.error} data={roles.data}>
        {(rows) => (
          <DataTable rows={rows} rowKey={(r) => r.key} onRowClick={open} empty="No roles."
            columns={[
              { key: "n", label: "Role", render: (r) => <span className="font-semibold">{r.name}</span> },
              { key: "t", label: "Type", render: (r) => <Pill tone={r.is_system ? "neutral" : "warn"}>{r.is_system ? "built-in" : "custom"}</Pill> },
              { key: "u", label: "People", render: (r) => r.users },
              { key: "p", label: "Permissions", render: (r) => <span className="text-xs text-muted">{r.permissions.length}</span> },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (r) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => open(r)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>
                    {!r.is_system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (window.confirm(`Delete role "${r.name}"?`)) {
                            if (await act.run(() => adm.del(`/roles/${r.key}`), "Role deleted.")) {
                              roles.reload();
                            }
                          }
                        }}
                        className="h-8 px-2 text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]} />
        )}
      </Section>
      {editing ? (
        <AdminModal
          open={true}
          onClose={() => setEditing(null)}
          title={editing === "new" ? "New Role" : `Edit Role: ${editing.name}`}
          subtitle="Define role name and granular feature access permissions"
          size="lg"
        >
          <form className="grid gap-4" aria-label="Role form" onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act.run(() => (editing === "new" ? adm.post("/roles", { name, permissions: chosen }) : adm.patch(`/roles/${editing.key}`, { name, permissions: chosen })), "Saved.");
            if (ok) { roles.reload(); setEditing(null); }
          }}>
            <Feedback error={act.error} note={act.note} />
            {editing !== "new" && editing.is_system ? <p className="text-sm text-muted">Built-in roles are read-only. Create a custom role to adjust permissions.</p> : null}
            <TextField id="role-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} error={act.fields.name} disabled={editing !== "new" && editing.is_system} />
            <Section loading={perms.loading} error={perms.error} data={perms.data}>
              {(groups) => (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(groups).map(([group, keys]) => (
                    <fieldset key={group} className="rounded-control border border-line p-3">
                      <legend className="px-1 text-sm font-semibold capitalize">{group}</legend>
                      {keys.map((k) => (
                        <label key={k} className="flex items-center gap-2 py-0.5 text-sm">
                          <input type="checkbox" className="size-4 accent-[var(--accent)]" disabled={editing !== "new" && editing.is_system} checked={chosen.includes(k)} onChange={() => setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))} />
                          {k.split(".")[1].replaceAll("_", " ")}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              )}
            </Section>
            {act.fields.permissions ? <p role="alert" className="text-sm text-red-500">{act.fields.permissions}</p> : null}
            <div className="flex gap-3">
              {editing === "new" || !editing.is_system ? <Button type="submit" disabled={act.busy || !name || chosen.length === 0}>Save role</Button> : null}
              {editing !== "new" && !editing.is_system ? <Button type="button" variant="secondary" onClick={async () => { if (window.confirm("Delete this role?") && (await act.run(() => adm.del(`/roles/${editing.key}`), "Deleted."))) { roles.reload(); setEditing(null); } }}>Delete</Button> : null}
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Close</Button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
