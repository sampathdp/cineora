"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { zonedToIso } from "./showtimes-admin";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Panel, Pager, Pill, Section, SelectField, TextArea, TextField, useAction, useLoad, when } from "./kit";
import { cn } from "@/lib/utils";

type Tab = "events" | "articles" | "testimonials" | "inbox";
const TABS: [Tab, string][] = [["events", "Events"], ["articles", "News"], ["testimonials", "Testimonials"], ["inbox", "Messages and subscribers"]];

export function ContentAdmin() {
  const [tab, setTab] = useState<Tab>("articles");
  return (
    <section>
      <PageTitle
        title="Content Management"
        eyebrow="System & CMS"
        hint="Manage special film festivals, cinema news articles, visitor testimonials, and customer inquiries."
      />
      <div role="tablist" aria-label="Content type" className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold", tab === k ? "border-accent bg-accent text-on-accent" : "border-line hover:border-accent")}>{label}</button>
        ))}
      </div>
      {tab === "events" || tab === "articles" ? <Editorial key={tab} kind={tab} /> : null}
      {tab === "testimonials" ? <Testimonials /> : null}
      {tab === "inbox" ? <Inbox /> : null}
    </section>
  );
}

interface Item {
  id: string; slug: string; title: string; body: string | null; excerpt?: string | null; status: "draft" | "scheduled" | "published" | "archived";
  image_url: string | null; is_featured: boolean; scheduled_at: string | null; published_at: string | null; starts_at?: string | null; ends_at?: string | null;
  category?: { slug: string; name: string } | null;
}
const tone = { draft: "neutral", scheduled: "warn", published: "good", archived: "neutral" } as const;

function Editorial({ kind }: { kind: "events" | "articles" }) {
  const act = useAction();
  const list = useLoad(() => adm.get<Item[]>(`/${kind}`).then((r) => r.data), `ed-${kind}`);
  const cats = useLoad(() => (kind === "articles" ? adm.get<{ slug: string; name: string }[]>("/article-categories").then((r) => r.data) : Promise.resolve([])), `cats-${kind}`);
  const [editing, setEditing] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const open = (id: string | null) => { setCreatedId(null); setEditing(id); };
  const selected = list.data?.find((i) => i.id === editing) ?? null;
  const noun = kind === "events" ? "event" : "article";

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => open("new")}><Plus className="size-4" aria-hidden /> New {noun}</Button></div>
      <Feedback error={act.error} note={act.note} />
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable rows={rows} rowKey={(i) => i.id} onRowClick={(i) => open(i.id)} empty={`No ${kind} yet.`}
            columns={[
              { key: "t", label: "Title", render: (i) => <span className="font-semibold">{i.title}</span> },
              { key: "s", label: "Status", render: (i) => <Pill tone={tone[i.status]}>{i.status}</Pill> },
              { key: "d", label: kind === "events" ? "Starts" : "Published", render: (i) => when(kind === "events" ? i.starts_at : i.published_at) },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (i) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => open(i.id)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>
                    {i.status !== "published" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (await act.run(() => adm.post(`/content/${kind}/${i.id}/publish`), "Published.")) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2 text-xs cursor-pointer"
                      >
                        Publish
                      </Button>
                    )}
                    {i.status === "published" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await act.run(() => adm.post(`/content/${kind}/${i.id}/unpublish`), "Unpublished.")) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2 text-xs text-muted hover:text-foreground cursor-pointer"
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (window.confirm(`Delete ${noun} "${i.title}"?`)) {
                          if (await act.run(() => adm.del(`/content/${kind}/${i.id}`), "Deleted.")) {
                            list.reload();
                          }
                        }
                      }}
                      className="h-8 px-2 text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                      aria-label={`Delete ${i.title}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]} />
        )}
      </Section>
      {editing ? <ItemEditor key={editing === "new" || editing === createdId ? "created" : editing} kind={kind} item={editing === "new" ? null : selected} categories={cats.data ?? []} onClose={() => open(null)} onSaved={(id) => { list.reload(); if (id) { setCreatedId(id); setEditing(id); } }} /> : null}
    </>
  );
}

function ItemEditor({ kind, item, categories, onClose, onSaved }: { kind: "events" | "articles"; item: Item | null; categories: { slug: string; name: string }[]; onClose: () => void; onSaved: (id?: string) => void }) {
  const act = useAction();
  const isEvent = kind === "events";
  const [f, setF] = useState({ title: item?.title ?? "", body: item?.body ?? "", excerpt: item?.excerpt ?? "", category: item?.category?.slug ?? "", is_featured: item?.is_featured ?? false, starts: "", ends: "" });
  const [schedule, setSchedule] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { title: f.title, body: f.body, is_featured: f.is_featured };
    if (isEvent) { if (f.starts) body.starts_at = zonedToIso(f.starts, "Asia/Seoul"); if (f.ends) body.ends_at = zonedToIso(f.ends, "Asia/Seoul"); }
    else { body.excerpt = f.excerpt || null; body.category = f.category || null; }
    const path = isEvent ? "/events" : "/articles";
    const r = await act.run(() => (item ? adm.patch<Item>(`${path}/${item.id}`, body) : adm.post<Item>(path, body)), "Saved.");
    if (r) onSaved(r.data.id);
  }
  const step = (action: "publish" | "unpublish" | "schedule", ok: string) => async () => {
    if (!item) return;
    if (await act.run(() => adm.post(`/content/${kind}/${item.id}/${action}`, action === "schedule" ? { scheduled_at: zonedToIso(schedule, "Asia/Seoul") } : undefined), ok)) onSaved();
  };

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={item ? `Edit: ${item.title}` : `New ${isEvent ? "Event" : "Article"}`}
      subtitle="Editorial content, publication status, and scheduling"
      size="xl"
    >
      <form onSubmit={save} noValidate className="grid gap-4" aria-label="Content form">
        <Feedback error={act.error} note={act.note} />
        <TextField id="ct-title" label="Title" value={f.title} onChange={(e) => set("title", e.target.value)} error={act.fields.title} />
        {!isEvent ? <TextField id="ct-ex" label="Short summary" value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} error={act.fields.excerpt} /> : null}
        {isEvent ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="ct-start" label="Starts (Seoul time)" type="datetime-local" value={f.starts} onChange={(e) => set("starts", e.target.value)} error={act.fields.starts_at} hint={item?.starts_at ? `Currently ${when(item.starts_at)}` : undefined} />
            <TextField id="ct-end" label="Ends (Seoul time)" type="datetime-local" value={f.ends} onChange={(e) => set("ends", e.target.value)} error={act.fields.ends_at} />
          </div>
        ) : (
          <SelectField id="ct-cat" label="Category" value={f.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </SelectField>
        )}
        <TextArea id="ct-body" label="Text" rows={10} value={f.body} onChange={(e) => set("body", e.target.value)} error={act.fields.body} hint="Plain text. Leave a blank line between paragraphs." />
        <CheckField id="ct-feat" label="Feature on the site" checked={f.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
        <div className="flex gap-3"><Button type="submit" disabled={act.busy}>{act.busy ? "Saving…" : "Save"}</Button><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div>
      </form>

      {item ? (
        <div className="mt-6 grid gap-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={tone[item.status]}>{item.status}{item.scheduled_at ? ` for ${when(item.scheduled_at)}` : ""}</Pill>
            {item.status !== "published" ? <Button size="sm" disabled={act.busy} onClick={step("publish", "Published.")}>Publish now</Button> : <Button size="sm" variant="secondary" disabled={act.busy} onClick={step("unpublish", "Moved back to draft.")}>Unpublish</Button>}
          </div>
          {item.status !== "published" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-60"><TextField id="ct-sched" label="Or publish automatically at (Seoul time)" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} error={act.fields.scheduled_at} /></div>
              <Button size="sm" variant="secondary" disabled={act.busy || !schedule} onClick={step("schedule", "Scheduled.")}>Schedule</Button>
            </div>
          ) : null}
          <div>
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image
              <img src={item.image_url} alt="Current cover" className="mb-2 max-h-32 rounded-control border border-line" />
            ) : null}
            <label htmlFor="ct-img" className="inline-flex min-h-10 cursor-pointer items-center rounded-control border border-line px-3 text-sm font-semibold hover:border-accent">Upload cover image</label>
            <input id="ct-img" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file && (await act.run(() => adm.upload(`/content/${kind}/${item.id}/image`, file), "Image updated."))) onSaved(); }} />
          </div>
          <div><Button size="sm" variant="ghost" onClick={async () => { if (window.confirm("Delete this permanently?") && (await act.run(() => adm.del(`/content/${kind}/${item.id}`)))) { onSaved(); onClose(); } }}>Delete</Button></div>
        </div>
      ) : null}
    </AdminModal>
  );
}

interface T { id: number; name: string; title: string | null; quote: string; rating: number; is_published: boolean }
function Testimonials() {
  const list = useLoad(() => adm.get<T[]>("/testimonials").then((r) => r.data), "testi");
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", title: "", quote: "", rating: "5", is_published: true });
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> Add testimonial
        </Button>
      </div>
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable rows={rows} rowKey={(t) => String(t.id)} empty="No testimonials yet."
            columns={[
              { key: "n", label: "Name", render: (t) => <span className="font-semibold">{t.name}</span> },
              { key: "q", label: "Quote", render: (t) => t.quote },
              { key: "r", label: "Stars", render: (t) => t.rating },
              { key: "p", label: "Shown", render: (t) => <Pill tone={t.is_published ? "good" : "neutral"}>{t.is_published ? "yes" : "no"}</Pill> },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (t) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (await act.run(() => adm.patch(`/testimonials/${t.id}`, { is_published: !t.is_published }), t.is_published ? "Hidden." : "Published.")) {
                          list.reload();
                        }
                      }}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      {t.is_published ? "Hide" : "Show"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (window.confirm("Delete this testimonial?")) {
                          if (await act.run(() => adm.del(`/testimonials/${t.id}`), "Deleted.")) {
                            list.reload();
                          }
                        }
                      }}
                      className="h-8 px-2 text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                      aria-label="Delete testimonial"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]} />
        )}
      </Section>
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Testimonial"
        subtitle="Customer feedback displayed on the website"
        size="md"
      >
        <form className="grid gap-4 sm:grid-cols-2" aria-label="Add testimonial" onSubmit={async (e) => { e.preventDefault(); if (await act.run(() => adm.post("/testimonials", { ...f, title: f.title || null, rating: Number(f.rating) }), "Added.")) { setF({ ...f, name: "", title: "", quote: "" }); setOpen(false); list.reload(); } }}>
          <div className="sm:col-span-2"><Feedback error={act.error} note={act.note} /></div>
          <TextField id="t-name" label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={act.fields.name} />
          <TextField id="t-title" label="Description (optional)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="sm:col-span-2"><TextArea id="t-quote" label="Quote" value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} error={act.fields.quote} /></div>
          <SelectField id="t-rate" label="Stars" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</SelectField>
          <CheckField id="t-pub" label="Show on the website" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} />
          <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-line/40">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={act.busy}>{act.busy ? "Adding…" : "Add Testimonial"}</Button>
          </div>
        </form>
      </AdminModal>
    </>
  );
}

interface Msg { id: number; name: string; email: string; subject: string | null; message: string; status: string; received_at: string }
function Inbox() {
  const [page, setPage] = useState(1);
  const act = useAction();
  const msgs = useLoad(() => adm.get<Msg[]>("/messages", { page }), `msgs-${page}`);
  const subs = useLoad(() => adm.get<{ email: string; subscribed_at: string }[]>("/newsletter"), "subs");
  return (
    <div className="grid gap-8">
      <Feedback error={act.error} note={act.note} />
      <Section loading={msgs.loading} error={msgs.error} data={msgs.data}>
        {(res) => (
          <>
            <DataTable rows={res.data} rowKey={(m) => String(m.id)} empty="No messages."
              columns={[
                { key: "f", label: "From", render: (m) => <span>{m.name}<span className="block text-xs text-muted">{m.email}</span></span> },
                { key: "m", label: "Message", render: (m) => <span><strong>{m.subject}</strong><span className="block whitespace-pre-line text-muted">{m.message}</span></span> },
                { key: "w", label: "Received", render: (m) => when(m.received_at) },
                { key: "s", label: "", render: (m) => m.status === "new" ? <Button size="sm" variant="secondary" onClick={async () => { if (await act.run(() => adm.post(`/messages/${m.id}/handled`))) msgs.reload(); }}>Mark handled</Button> : <Pill tone="good">handled</Pill> },
              ]} />
            <Pager page={Number(res.meta?.page ?? 1)} last={Number(res.meta?.last_page ?? 1)} onPage={setPage} />
          </>
        )}
      </Section>
      <Panel title="Newsletter subscribers">
        <Section loading={subs.loading} error={subs.error} data={subs.data}>
          {(res) => <p className="text-sm">{String(res.meta?.total ?? res.data.length)} subscribers. Latest: {res.data.slice(0, 5).map((s) => s.email).join(", ") || "none"}.</p>}
        </Section>
      </Panel>
    </div>
  );
}
