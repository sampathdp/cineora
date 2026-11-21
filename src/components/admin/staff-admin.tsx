"use client";

import { useState } from "react";
import { Check, Edit2, KeyRound, Lock, Plus, ShieldAlert, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, DataTable, Feedback, PageTitle, Panel, Pill, Section, TextField, useAction, useLoad, when } from "./kit";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/dialogs";

interface Staff {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  roles: string[];
  mfa_enabled: boolean;
  last_login_at: string | null;
  cinemas: { id: string; name: string }[];
}
interface RoleRow {
  key: string;
  name: string;
  is_system: boolean;
  users: number;
  permissions: string[];
}

export function StaffAdmin() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"people" | "roles">("people");

  return (
    <section className="space-y-6">
      <PageTitle
        title="Staff & Role Permissions"
        eyebrow="Security & Access Control"
        icon={ShieldCheck}
        hint="Manage staff credentials, assigned cinema venues, role-based access control (RBAC), and two-factor authentication."
      />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Staff sections"
        className="inline-flex rounded-2xl border border-line/70 bg-surface/70 p-1.5 shadow-sm backdrop-blur-sm"
      >
        {([
          ["people", "Staff Members", Users],
          ["roles", "Roles & Permissions", KeyRound],
        ] as const)
          .filter(([k]) => k === "people" || can("roles.manage"))
          .map(([k, label, Icon]) => {
            const isActive = tab === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(k)}
                className={cn(
                  "flex items-center gap-2 min-h-9 rounded-xl px-4 text-xs font-bold transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-accent text-on-accent shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
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
  const cinemas = useLoad(
    () => adm.get<{ id: string; name: string }[]>("/cinemas").then((r) => r.data),
    "staff-cinemas",
  );
  const [editing, setEditing] = useState<string | null>(null);
  const selected = list.data?.find((s) => s.id === editing) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted">
          Staff credentials and venue assignment for operational users.
        </p>
        <Button onClick={() => setEditing("new")} className="shadow-sm">
          <UserPlus className="size-4 mr-1.5" aria-hidden />
          <span>Add staff member</span>
        </Button>
      </div>

      <Feedback error={act.error} note={act.note} />

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(s) => s.id}
            onRowClick={(s) => setEditing(s.id)}
            empty="No staff members registered."
            columns={[
              {
                key: "n",
                label: "Personnel",
                render: (s) => (
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent font-bold text-xs border border-accent/20">
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{s.name}</span>
                        {s.id === user?.id && (
                          <span className="rounded bg-accent/15 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted block">{s.email}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: "r",
                label: "Assigned Roles",
                render: (s) => (
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {s.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent capitalize"
                      >
                        {r.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                key: "c",
                label: "Managed Venues",
                render: (s) => (
                  <span className="text-xs text-muted">
                    {s.cinemas.map((c) => c.name).join(", ") || "All Venues"}
                  </span>
                ),
              },
              {
                key: "m",
                label: "Two-Factor Auth",
                render: (s) => (
                  <Pill tone={s.mfa_enabled ? "good" : "warn"}>
                    {s.mfa_enabled ? "2FA Active" : "2FA Off"}
                  </Pill>
                ),
              },
              {
                key: "l",
                label: "Last Sign-In",
                render: (s) => <span className="text-xs text-muted">{when(s.last_login_at)}</span>,
              },
              {
                key: "a",
                label: "Status",
                render: (s) => (
                  <Pill tone={s.is_active ? "good" : "bad"}>
                    {s.is_active ? "Active" : "Disabled"}
                  </Pill>
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
                      onClick={() => setEditing(s.id)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>
                    {s.id !== user?.id && can("roles.manage") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (
                            await act.run(
                              () => adm.patch(`/staff/${s.id}`, { is_active: !s.is_active }),
                              s.is_active ? "Account disabled." : "Account activated.",
                            )
                          ) {
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
            ]}
          />
        )}
      </Section>

      {editing && (
        <StaffEditor
          key={editing}
          person={editing === "new" ? null : selected}
          roles={roles.data ?? []}
          cinemas={cinemas.data ?? []}
          isSelf={selected?.id === user?.id}
          canResetMfa={can("roles.manage") || !!user?.roles.includes("super_admin")}
          onClose={() => setEditing(null)}
          onSaved={() => {
            list.reload();
          }}
        />
      )}
    </div>
  );
}

function StaffEditor({
  person,
  roles,
  cinemas,
  isSelf,
  canResetMfa,
  onClose,
  onSaved,
}: {
  person: Staff | null;
  roles: RoleRow[];
  cinemas: { id: string; name: string }[];
  isSelf: boolean;
  canResetMfa: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const act = useAction();
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [chosenRoles, setChosenRoles] = useState<string[]>(person?.roles ?? []);
  const [chosenCinemas, setChosenCinemas] = useState<string[]>(person?.cinemas.map((c) => c.id) ?? []);
  const staffRoles = roles.filter((r) => r.key !== "customer");
  const toggle = (set: (f: (x: string[]) => string[]) => void, v: string) =>
    set((x) => (x.includes(v) ? x.filter((i) => i !== v) : [...x, v]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = person
      ? await act.run(
          () => adm.patch(`/staff/${person.id}`, { name, ...(isSelf ? {} : { roles: chosenRoles }), cinemas: chosenCinemas }),
          "Saved.",
        )
      : await act.run(
          () => adm.post("/staff", { name, email, roles: chosenRoles, cinemas: chosenCinemas }),
          "Staff created. An invitation email was sent.",
        );
    if (r) onSaved();
  }

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={person ? `Edit Staff: ${person.name}` : "Add Staff Member"}
      subtitle="Staff profile credentials, venue assignments, and role permissions"
      size="lg"
    >
      <form onSubmit={save} noValidate className="space-y-6" aria-label="Staff form">
        <Feedback error={act.error} note={act.note} />

        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="s-name"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={act.fields.name}
            />
            <TextField
              id="s-mail"
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={act.fields.email}
              disabled={!!person}
            />
          </div>
        </div>

        {/* Roles Selection */}
        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Assigned Roles {isSelf ? "(Self-modification locked)" : ""}
          </h4>
          {act.fields.roles && <p role="alert" className="text-xs text-rose-500">{act.fields.roles}</p>}
          <div className="flex flex-wrap gap-2">
            {staffRoles.map((r) => {
              const active = chosenRoles.includes(r.key);
              return (
                <label
                  key={r.key}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                    active
                      ? "border-accent bg-accent/15 text-accent shadow-sm"
                      : "border-line/70 bg-elevated/70 text-muted hover:border-line hover:text-foreground",
                    isSelf && "opacity-60 cursor-not-allowed",
                  )}
                  title={r.permissions.join(", ")}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    disabled={isSelf}
                    checked={active}
                    onChange={() => toggle(setChosenRoles, r.key)}
                  />
                  <span>{r.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Cinema Venues Assignment */}
        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Managed Cinema Venues
          </h4>
          <div className="flex flex-wrap gap-2">
            {cinemas.map((c) => {
              const active = chosenCinemas.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                    active
                      ? "border-accent bg-accent/15 text-accent shadow-sm"
                      : "border-line/70 bg-elevated/70 text-muted hover:border-line hover:text-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={active}
                    onChange={() => toggle(setChosenCinemas, c.id)}
                  />
                  <span>{c.name}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-muted">
            Cinema-scoped permissions only take effect for venues marked here.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
          <div className="flex items-center gap-2.5">
            <Button type="submit" disabled={act.busy || !name || chosenRoles.length === 0} className="shadow-sm">
              {act.busy ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
              Close
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {person && !isSelf && canResetMfa && (
              <Button
                type="button"
                variant="secondary"
                disabled={act.busy}
                onClick={async () => {
                  if (
                    (await confirmDialog({ title: "Reset two-factor authentication?", message: "They must set up their authenticator again at next sign-in.", confirmLabel: "Reset 2FA", danger: true })) &&
                    (await act.run(() => adm.post(`/staff/${person.id}/reset-mfa`), "Two-factor reset."))
                  ) {
                    onSaved();
                  }
                }}
                className="text-xs"
              >
                Reset 2FA
              </Button>
            )}

            {person && !isSelf && (
              <Button
                type="button"
                variant="ghost"
                disabled={act.busy}
                onClick={async () => {
                  if (
                    (await confirmDialog(
                      person.is_active
                        ? { title: "Disable this account?", message: "All active sessions are signed out immediately.", confirmLabel: "Disable", danger: true }
                        : { title: "Re-enable this account?", confirmLabel: "Enable" },
                    )) &&
                    (await act.run(
                      () => adm.patch(`/staff/${person.id}`, { is_active: !person.is_active }),
                      person.is_active ? "Account disabled." : "Account enabled.",
                    ))
                  ) {
                    onSaved();
                  }
                }}
                className={cn("text-xs", person.is_active ? "text-rose-500 hover:bg-rose-500/10" : "text-emerald-500")}
              >
                {person.is_active ? "Disable Account" : "Enable Account"}
              </Button>
            )}
          </div>
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
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted">
          Role-based access control matrix with fine-grained capability flags.
        </p>
        <Button onClick={() => open("new")} className="shadow-sm">
          <Plus className="size-4 mr-1.5" aria-hidden />
          <span>New role</span>
        </Button>
      </div>

      <Section loading={roles.loading} error={roles.error} data={roles.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => r.key}
            onRowClick={open}
            empty="No custom roles defined."
            columns={[
              {
                key: "n",
                label: "Role Name",
                render: (r) => <span className="font-bold text-foreground">{r.name}</span>,
              },
              {
                key: "t",
                label: "Classification",
                render: (r) => (
                  <Pill tone={r.is_system ? "neutral" : "warn"}>
                    {r.is_system ? "System Built-in" : "Custom"}
                  </Pill>
                ),
              },
              {
                key: "u",
                label: "Staff Assigned",
                render: (r) => (
                  <span className="rounded-full border border-line/70 bg-surface/80 px-2.5 py-0.5 text-xs font-bold text-foreground">
                    {r.users} users
                  </span>
                ),
              },
              {
                key: "p",
                label: "Permissions Count",
                render: (r) => <span className="text-xs font-semibold text-accent">{r.permissions.length} capabilities</span>,
              },
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
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Configure</span>
                    </Button>
                    {!r.is_system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if ((await confirmDialog({ title: `Delete role "${r.name}"?`, message: "This cannot be undone.", confirmLabel: "Delete role", danger: true }))) {
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
            ]}
          />
        )}
      </Section>

      {editing && (
        <AdminModal
          open={true}
          onClose={() => setEditing(null)}
          title={editing === "new" ? "New Security Role" : `Edit Role: ${editing.name}`}
          subtitle="Configure role name and granular capabilities matrix"
          size="lg"
        >
          <form
            className="space-y-6"
            aria-label="Role form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await act.run(
                () =>
                  editing === "new"
                    ? adm.post("/roles", { name, permissions: chosen })
                    : adm.patch(`/roles/${editing.key}`, { name, permissions: chosen }),
                "Saved.",
              );
              if (ok) {
                roles.reload();
                setEditing(null);
              }
            }}
          >
            <Feedback error={act.error} note={act.note} />

            {editing !== "new" && editing.is_system && (
              <p className="text-xs text-amber-500 font-medium rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                Built-in system roles cannot have their core permissions modified. Create a custom role to configure specific access.
              </p>
            )}

            <TextField
              id="role-name"
              label="Role Title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={act.fields.name}
              disabled={editing !== "new" && editing.is_system}
            />

            <Section loading={perms.loading} error={perms.error} data={perms.data}>
              {(groups) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(groups).map(([group, keys]) => (
                    <div key={group} className="rounded-2xl border border-line/60 bg-surface/40 p-4 space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-muted capitalize">
                        {group} Permissions
                      </h5>
                      <div className="space-y-1.5">
                        {keys.map((k) => (
                          <label key={k} className="flex items-center gap-2.5 text-xs text-foreground select-none cursor-pointer">
                            <input
                              type="checkbox"
                              className="size-4 rounded accent-[var(--accent)]"
                              disabled={editing !== "new" && editing.is_system}
                              checked={chosen.includes(k)}
                              onChange={() =>
                                setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))
                              }
                            />
                            <span>{k.split(".")[1]?.replaceAll("_", " ") ?? k}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {act.fields.permissions && <p role="alert" className="text-xs text-rose-500">{act.fields.permissions}</p>}

            <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-4">
              <div className="flex items-center gap-2.5">
                {(editing === "new" || !editing.is_system) && (
                  <Button type="submit" disabled={act.busy || !name || chosen.length === 0} className="shadow-sm">
                    Save Role
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Close
                </Button>
              </div>

              {editing !== "new" && !editing.is_system && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (
                      (await confirmDialog({ title: "Delete this role?", message: "This cannot be undone.", confirmLabel: "Delete role", danger: true })) &&
                      (await act.run(() => adm.del(`/roles/${editing.key}`), "Deleted."))
                    ) {
                      roles.reload();
                      setEditing(null);
                    }
                  }}
                  className="text-rose-500 hover:bg-rose-500/10 text-xs"
                >
                  Delete Role
                </Button>
              )}
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
