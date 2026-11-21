"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  Edit2,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Newspaper,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { zonedToIso } from "./showtimes-admin";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Panel, Pager, Pill, Section, SelectField, TextArea, TextField, useAction, useLoad, when } from "./kit";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/dialogs";

type Tab = "events" | "articles" | "testimonials" | "inbox";
const TABS: [Tab, string, React.ComponentType<{ className?: string }>][] = [
  ["articles", "Cinema News", Newspaper],
  ["events", "Events & Festivals", Calendar],
  ["testimonials", "Testimonials", Star],
  ["inbox", "Inquiries & Newsletter", Mail],
];

export function ContentAdmin() {
  const [tab, setTab] = useState<Tab>("articles");

  return (
    <section className="space-y-6">
      <PageTitle
        title="Content Management & Editorial CMS"
        eyebrow="System & CMS"
        icon={Newspaper}
        hint="Publish cinema news, premier festival announcements, customer reviews, and respond to public visitor inquiries."
      />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Content type"
        className="inline-flex rounded-2xl border border-line/70 bg-surface/70 p-1.5 shadow-sm backdrop-blur-sm"
      >
        {TABS.map(([k, label, Icon]) => {
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

      {tab === "events" || tab === "articles" ? <Editorial key={tab} kind={tab} /> : null}
      {tab === "testimonials" ? <Testimonials /> : null}
      {tab === "inbox" ? <Inbox /> : null}
    </section>
  );
}

interface Item {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  excerpt?: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  image_url: string | null;
  is_featured: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  category?: { slug: string; name: string } | null;
}
const tone = { draft: "neutral", scheduled: "warn", published: "good", archived: "neutral" } as const;

function Editorial({ kind }: { kind: "events" | "articles" }) {
  const act = useAction();
  const list = useLoad(() => adm.get<Item[]>(`/${kind}`).then((r) => r.data), `ed-${kind}`);
  const cats = useLoad(
    () => (kind === "articles" ? adm.get<{ slug: string; name: string }[]>("/article-categories").then((r) => r.data) : Promise.resolve([])),
    `cats-${kind}`,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const open = (id: string | null) => {
    setCreatedId(null);
    setEditing(id);
  };
  const selected = list.data?.find((i) => i.id === editing) ?? null;
  const noun = kind === "events" ? "Event" : "Article";

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted">
          Active publication feed for {kind === "events" ? "cinema events" : "news articles"}.
        </p>
        <Button onClick={() => open("new")} className="shadow-sm">
          <Plus className="size-4 mr-1.5" aria-hidden />
          <span>New {noun}</span>
        </Button>
      </div>

      <Feedback error={act.error} note={act.note} />

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(i) => i.id}
            onRowClick={(i) => open(i.id)}
            empty={`No ${kind} published yet.`}
            columns={[
              {
                key: "p",
                label: "Cover",
                className: "w-16",
                render: (i) => (
                  <div className="relative size-12 overflow-hidden rounded-xl border border-line/70 bg-surface/80 flex items-center justify-center">
                    {i.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image_url} alt={i.title} className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-5 text-muted/40" />
                    )}
                  </div>
                ),
              },
              {
                key: "t",
                label: "Title & Details",
                render: (i) => (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{i.title}</span>
                      {i.is_featured && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-500">
                          Featured
                        </span>
                      )}
                    </div>
                    {i.category && (
                      <span className="text-xs text-muted block mt-0.5">{i.category.name}</span>
                    )}
                  </div>
                ),
              },
              {
                key: "s",
                label: "Status",
                render: (i) => <Pill tone={tone[i.status]}>{i.status}</Pill>,
              },
              {
                key: "d",
                label: kind === "events" ? "Schedule" : "Published Date",
                render: (i) => (
                  <span className="text-xs text-muted">
                    {when(kind === "events" ? i.starts_at : i.published_at)}
                  </span>
                ),
              },
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
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
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
                        className="h-8 px-2 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
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
                        if ((await confirmDialog({ title: `Delete ${noun}?`, message: `"${i.title}" will be removed. This cannot be undone.`, confirmLabel: "Delete", danger: true }))) {
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
            ]}
          />
        )}
      </Section>

      {editing && (
        <ItemEditor
          key={editing === "new" || editing === createdId ? "created" : editing}
          kind={kind}
          item={editing === "new" ? null : selected}
          categories={cats.data ?? []}
          onClose={() => open(null)}
          onSaved={(id) => {
            list.reload();
            if (id) {
              setCreatedId(id);
              setEditing(id);
            }
          }}
        />
      )}
    </div>
  );
}

function ItemEditor({
  kind,
  item,
  categories,
  onClose,
  onSaved,
}: {
  kind: "events" | "articles";
  item: Item | null;
  categories: { slug: string; name: string }[];
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const act = useAction();
  const isEvent = kind === "events";
  const [f, setF] = useState({
    title: item?.title ?? "",
    body: item?.body ?? "",
    excerpt: item?.excerpt ?? "",
    category: item?.category?.slug ?? "",
    is_featured: item?.is_featured ?? false,
    starts: "",
    ends: "",
  });
  const [schedule, setSchedule] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { title: f.title, body: f.body, is_featured: f.is_featured };
    if (isEvent) {
      if (f.starts) body.starts_at = zonedToIso(f.starts, "Asia/Seoul");
      if (f.ends) body.ends_at = zonedToIso(f.ends, "Asia/Seoul");
    } else {
      body.excerpt = f.excerpt || null;
      body.category = f.category || null;
    }
    const path = isEvent ? "/events" : "/articles";
    const r = await act.run(() => (item ? adm.patch<Item>(`${path}/${item.id}`, body) : adm.post<Item>(path, body)), "Saved.");
    if (r) onSaved(r.data.id);
  }

  const step = (action: "publish" | "unpublish" | "schedule", ok: string) => async () => {
    if (!item) return;
    if (
      await act.run(
        () =>
          adm.post(
            `/content/${kind}/${item.id}/${action}`,
            action === "schedule" ? { scheduled_at: zonedToIso(schedule, "Asia/Seoul") } : undefined,
          ),
        ok,
      )
    ) {
      onSaved();
    }
  };

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={item ? `Edit: ${item.title}` : `New ${isEvent ? "Event" : "Article"}`}
      subtitle="Editorial copy, cover imagery, and scheduling"
      size="xl"
    >
      <form onSubmit={save} noValidate className="space-y-5" aria-label="Content form">
        <Feedback error={act.error} note={act.note} />

        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-4">
          <TextField
            id="ct-title"
            label="Title"
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            error={act.fields.title}
          />

          {!isEvent && (
            <TextField
              id="ct-ex"
              label="Short Excerpt"
              value={f.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              error={act.fields.excerpt}
            />
          )}

          {isEvent ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="ct-start"
                label="Event Starts (Seoul Time)"
                type="datetime-local"
                value={f.starts}
                onChange={(e) => set("starts", e.target.value)}
                error={act.fields.starts_at}
                hint={item?.starts_at ? `Currently: ${when(item.starts_at)}` : undefined}
              />
              <TextField
                id="ct-end"
                label="Event Ends (Seoul Time)"
                type="datetime-local"
                value={f.ends}
                onChange={(e) => set("ends", e.target.value)}
                error={act.fields.ends_at}
              />
            </div>
          ) : (
            <SelectField
              id="ct-cat"
              label="Category"
              value={f.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">None (General News)</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          )}

          <TextArea
            id="ct-body"
            label="Body Content"
            rows={10}
            value={f.body}
            onChange={(e) => set("body", e.target.value)}
            error={act.fields.body}
            hint="Plain text. Blank line between paragraphs."
          />

          <div className="pt-1">
            <CheckField
              id="ct-feat"
              label="Feature prominently on consumer website"
              checked={f.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line/60 pt-4">
          <Button type="submit" disabled={act.busy} className="shadow-sm">
            {act.busy ? "Saving…" : "Save Draft"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </form>

      {item && (
        <div className="mt-8 rounded-2xl border border-line/70 bg-surface/50 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-3">
            <div className="flex items-center gap-2">
              <Pill tone={tone[item.status]}>
                {item.status}
                {item.scheduled_at ? ` · ${when(item.scheduled_at)}` : ""}
              </Pill>
            </div>

            <div className="flex items-center gap-2">
              {item.status !== "published" ? (
                <Button size="sm" disabled={act.busy} onClick={step("publish", "Published.")}>
                  Publish Now
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={act.busy} onClick={step("unpublish", "Moved back to draft.")}>
                  Unpublish
                </Button>
              )}
            </div>
          </div>

          {item.status !== "published" && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line/50 bg-elevated/70 p-4">
              <div className="min-w-60 flex-1">
                <TextField
                  id="ct-sched"
                  label="Schedule Automatic Publication (Seoul Time)"
                  type="datetime-local"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  error={act.fields.scheduled_at}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={act.busy || !schedule}
                onClick={step("schedule", "Scheduled.")}
                className="h-11"
              >
                Schedule Release
              </Button>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Cover Artwork</p>
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt="Current cover"
                className="mb-3 max-h-36 rounded-xl border border-line/70 object-cover shadow-sm"
              />
            ) : null}
            <label
              htmlFor="ct-img"
              className="inline-flex min-h-9 cursor-pointer items-center rounded-xl border border-line/80 bg-surface px-3.5 text-xs font-semibold hover:border-accent hover:text-accent transition shadow-sm"
            >
              Upload Cover Artwork
            </label>
            <input
              id="ct-img"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file && (await act.run(() => adm.upload(`/content/${kind}/${item.id}/image`, file), "Image updated."))) {
                  onSaved();
                }
              }}
            />
          </div>
        </div>
      )}
    </AdminModal>
  );
}

interface T {
  id: number;
  name: string;
  title: string | null;
  quote: string;
  rating: number;
  is_published: boolean;
}
function Testimonials() {
  const list = useLoad(() => adm.get<T[]>("/testimonials").then((r) => r.data), "testi");
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", title: "", quote: "", rating: "5", is_published: true });

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted">
          Customer testimonials and reviews displayed on the website.
        </p>
        <Button onClick={() => setOpen(true)} className="shadow-sm">
          <Plus className="size-4 mr-1.5" aria-hidden />
          <span>Add Testimonial</span>
        </Button>
      </div>

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(t) => String(t.id)}
            empty="No testimonials submitted yet."
            columns={[
              {
                key: "n",
                label: "Customer",
                render: (t) => (
                  <div>
                    <span className="font-bold text-foreground block">{t.name}</span>
                    {t.title && <span className="text-xs text-muted block">{t.title}</span>}
                  </div>
                ),
              },
              {
                key: "q",
                label: "Quote",
                render: (t) => <p className="italic text-xs text-foreground/90 max-w-md line-clamp-2">&quot;{t.quote}&quot;</p>,
              },
              {
                key: "r",
                label: "Rating",
                render: (t) => (
                  <span className="font-bold text-amber-500 text-xs">
                    {"★".repeat(t.rating)}
                  </span>
                ),
              },
              {
                key: "p",
                label: "Visible",
                render: (t) => (
                  <Pill tone={t.is_published ? "good" : "neutral"}>
                    {t.is_published ? "Visible" : "Hidden"}
                  </Pill>
                ),
              },
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
                        if (
                          await act.run(
                            () => adm.patch(`/testimonials/${t.id}`, { is_published: !t.is_published }),
                            t.is_published ? "Hidden." : "Published.",
                          )
                        ) {
                          list.reload();
                        }
                      }}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      {t.is_published ? "Hide" : "Show"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if ((await confirmDialog({ title: "Delete this testimonial?", message: "This cannot be undone.", confirmLabel: "Delete", danger: true }))) {
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
            ]}
          />
        )}
      </Section>

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Testimonial"
        subtitle="Customer quote and star rating displayed on the website landing page"
        size="md"
      >
        <form
          className="space-y-4"
          aria-label="Add testimonial"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act.run(
                () => adm.post("/testimonials", { ...f, title: f.title || null, rating: Number(f.rating) }),
                "Added.",
              )
            ) {
              setF({ ...f, name: "", title: "", quote: "" });
              setOpen(false);
              list.reload();
            }
          }}
        >
          <Feedback error={act.error} note={act.note} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="t-name"
              label="Author Name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              error={act.fields.name}
            />
            <TextField
              id="t-title"
              label="Author Subtitle (Optional)"
              placeholder="e.g. Cinema Enthusiast"
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </div>
          <TextArea
            id="t-quote"
            label="Feedback Quote"
            rows={4}
            value={f.quote}
            onChange={(e) => setF({ ...f, quote: e.target.value })}
            error={act.fields.quote}
          />
          <SelectField
            id="t-rate"
            label="Star Rating"
            value={f.rating}
            onChange={(e) => setF({ ...f, rating: e.target.value })}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} Stars {"★".repeat(n)}
              </option>
            ))}
          </SelectField>
          <CheckField
            id="t-pub"
            label="Publish publicly on the website immediately"
            checked={f.is_published}
            onChange={(e) => setF({ ...f, is_published: e.target.checked })}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line/60">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={act.busy} className="shadow-sm">
              {act.busy ? "Adding…" : "Add Testimonial"}
            </Button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

interface Msg {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  received_at: string;
}
function Inbox() {
  const [page, setPage] = useState(1);
  const act = useAction();
  const msgs = useLoad(() => adm.get<Msg[]>("/messages", { page }), `msgs-${page}`);
  const subs = useLoad(() => adm.get<{ email: string; subscribed_at: string }[]>("/newsletter"), "subs");

  return (
    <div className="space-y-6">
      <Feedback error={act.error} note={act.note} />
      <Section loading={msgs.loading} error={msgs.error} data={msgs.data}>
        {(res) => (
          <>
            <DataTable
              rows={res.data}
              rowKey={(m) => String(m.id)}
              empty="No customer inquiries received yet."
              columns={[
                {
                  key: "f",
                  label: "Sender",
                  render: (m) => (
                    <div>
                      <span className="font-bold text-foreground block">{m.name}</span>
                      <span className="text-xs text-muted block">{m.email}</span>
                    </div>
                  ),
                },
                {
                  key: "m",
                  label: "Message Content",
                  render: (m) => (
                    <div className="max-w-md">
                      <strong className="text-foreground block text-xs">{m.subject ?? "General Inquiry"}</strong>
                      <span className="block whitespace-pre-line text-xs text-muted mt-0.5 line-clamp-3">
                        {m.message}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "w",
                  label: "Received",
                  render: (m) => <span className="text-xs text-muted">{when(m.received_at)}</span>,
                },
                {
                  key: "s",
                  label: "Status",
                  render: (m) =>
                    m.status === "new" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (await act.run(() => adm.post(`/messages/${m.id}/handled`))) msgs.reload();
                        }}
                        className="h-8 text-xs cursor-pointer shadow-sm"
                      >
                        Mark Handled
                      </Button>
                    ) : (
                      <Pill tone="good">Handled</Pill>
                    ),
                },
              ]}
            />
            <Pager
              page={Number(res.meta?.page ?? 1)}
              last={Number(res.meta?.last_page ?? 1)}
              onPage={setPage}
            />
          </>
        )}
      </Section>

      <Panel title="Newsletter Subscribers" icon={Mail}>
        <Section loading={subs.loading} error={subs.error} data={subs.data}>
          {(res) => (
            <div className="space-y-3">
              <p className="text-sm">
                Total Audience: <strong className="font-bold text-accent">{String(res.meta?.total ?? res.data.length)}</strong> active subscribers.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                {res.data.slice(0, 8).map((s) => (
                  <span key={s.email} className="rounded-full border border-line/60 bg-surface/60 px-3 py-1">
                    {s.email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      </Panel>
    </div>
  );
}
