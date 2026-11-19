"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { apiGet } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AdminModal, CheckField, DataTable, Feedback, Panel, PageTitle, Pill, Section, SelectField, TextArea, TextField, useAction, useLoad, when } from "./kit";

interface Movie {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  duration_min: number;
  release_date: string | null;
  age_rating: string | null;
  rating: number | null;
  screening_status: "now_playing" | "coming_soon";
  is_featured: boolean;
  poster_url: string | null;
  banner_url: string | null;
  trailer_url: string | null;
  status: "draft" | "published" | "archived";
  genres: { slug: string; name: string }[];
  cast: { name: string; role: string | null }[];
  crew: { name: string; job: string }[];
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
}

const tone = { draft: "neutral", published: "good", archived: "warn" } as const;

export function MoviesAdmin() {
  const { can } = useAuth();
  const act = useAction();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // movie id, "new" or null
  // After creating, keep the same editor instance (and its "Saved." note) instead of remounting a blank one.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const open = (id: string | null) => { setCreatedId(null); setEditing(id); };
  const list = useLoad(() => adm.get<Movie[]>("/movies", { q, status, per_page: 50 }).then((r) => r.data), `movies-${q}-${status}`);
  const genres = useLoad(() => apiGet<{ slug: string; name: string }[]>("/genres").then((r) => r.data), "genres");
  const selected = list.data?.find((m) => m.id === editing) ?? null;

  return (
    <section>
      <PageTitle
        title="Movies & Catalog"
        eyebrow="Cinema Operations"
        hint="Manage cinematic titles, poster artwork, synopsis, cast, and screening status."
        action={can("movies.manage") ? <Button onClick={() => open("new")}><Plus className="size-4" aria-hidden /> New movie</Button> : undefined}
      />
      <Feedback error={act.error} note={act.note} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <TextField id="mq" label="Search title" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField id="ms" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </SelectField>
      </div>
      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(m) => m.id}
            onRowClick={(m) => open(m.id)}
            empty="No movies match."
            columns={[
              { key: "t", label: "Title", render: (m) => <button className="text-left font-semibold hover:text-accent-text" onClick={() => open(m.id)}>{m.title}</button> },
              { key: "s", label: "Status", render: (m) => <Pill tone={tone[m.status]}>{m.status}</Pill> },
              { key: "p", label: "Showing", render: (m) => m.screening_status.replace("_", " ") },
              { key: "r", label: "Release", render: (m) => m.release_date ?? "—" },
              { key: "u", label: "Updated", render: (m) => when(m.updated_at) },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (m) => (
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => open(m.id)}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>

                    {can("movies.publish") && m.status !== "published" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (await act.run(() => adm.post(`/movies/${m.id}/publish`), "Published.")) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2 text-xs cursor-pointer"
                      >
                        Publish
                      </Button>
                    )}

                    {can("movies.publish") && m.status === "published" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await act.run(() => adm.post(`/movies/${m.id}/unpublish`), "Unpublished.")) {
                            list.reload();
                          }
                        }}
                        className="h-8 px-2 text-xs text-muted hover:text-foreground cursor-pointer"
                      >
                        Unpublish
                      </Button>
                    )}

                    {can("movies.manage") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (window.confirm(`Delete "${m.title}"? This cannot be undone.`)) {
                            if (await act.run(() => adm.del(`/movies/${m.id}`), "Movie deleted.")) {
                              list.reload();
                            }
                          }
                        }}
                        className="h-8 px-2 text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                        aria-label={`Delete ${m.title}`}
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

      {editing ? (
        <MovieEditor key={editing === "new" || editing === createdId ? "created" : editing} movie={editing === "new" ? null : selected} allGenres={genres.data ?? []} onClose={() => open(null)} onSaved={(id) => { list.reload(); if (id) { setCreatedId(id); setEditing(id); } }} />
      ) : null}
    </section>
  );
}

function MovieEditor({ movie, allGenres, onClose, onSaved }: { movie: Movie | null; allGenres: { slug: string; name: string }[]; onClose: () => void; onSaved: (id?: string) => void }) {
  const { can } = useAuth();
  const act = useAction();
  const [f, setF] = useState({
    title: movie?.title ?? "", tagline: movie?.tagline ?? "", description: movie?.description ?? "", duration_min: String(movie?.duration_min ?? 110),
    release_date: movie?.release_date ?? "", age_rating: movie?.age_rating ?? "", rating: movie?.rating !== null && movie?.rating !== undefined ? String(movie.rating) : "",
    screening_status: movie?.screening_status ?? "coming_soon", is_featured: movie?.is_featured ?? false, trailer_url: movie?.trailer_url ?? "",
    seo_title: movie?.seo_title ?? "", seo_description: movie?.seo_description ?? "",
  });
  const [genres, setGenres] = useState<string[]>(movie?.genres.map((g) => g.slug) ?? []);
  const [cast, setCast] = useState(movie?.cast ?? []);
  const [crew, setCrew] = useState(movie?.crew ?? []);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const canEdit = can("movies.manage");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...f, duration_min: Number(f.duration_min), rating: f.rating === "" ? null : Number(f.rating),
      release_date: f.release_date || null, tagline: f.tagline || null, description: f.description || null, age_rating: f.age_rating || null,
      trailer_url: f.trailer_url || null, seo_title: f.seo_title || null, seo_description: f.seo_description || null,
      genres, cast: cast.filter((c) => c.name.trim()), crew: crew.filter((c) => c.name.trim() && c.job.trim()),
    };
    const r = await act.run(() => (movie ? adm.patch<Movie>(`/movies/${movie.id}`, body) : adm.post<Movie>("/movies", body)), "Saved.");
    if (r) onSaved(r.data.id);
  }

  const transition = (what: "publish" | "unpublish" | "archive", ok: string) => async () => {
    if (!movie) return;
    if ((what === "archive" || what === "unpublish") && !window.confirm(`Really ${what} this movie?`)) return;
    if (await act.run(() => adm.post(`/movies/${movie.id}/${what}`), ok, true)) onSaved();
  };
  const upload = (kind: "poster" | "banner") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (movie && file && (await act.run(() => adm.upload(`/movies/${movie.id}/images/${kind}`, file), `${kind} updated.`))) onSaved();
  };

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={movie ? `Edit: ${movie.title}` : "New Movie"}
      subtitle="Catalog metadata, genres, cast, crew, artwork, and screening status"
      size="xl"
    >
      <form onSubmit={save} noValidate className="grid gap-4" aria-label="Movie form">
        <Feedback error={act.error} note={act.note} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="m-title" label="Title" value={f.title} onChange={(e) => set("title", e.target.value)} error={act.fields.title} disabled={!canEdit} />
          <TextField id="m-tag" label="Tagline" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} disabled={!canEdit} />
          <TextField id="m-dur" label="Duration (minutes)" inputMode="numeric" value={f.duration_min} onChange={(e) => set("duration_min", e.target.value)} error={act.fields.duration_min} disabled={!canEdit} />
          <TextField id="m-rel" label="Release date" type="date" value={f.release_date} onChange={(e) => set("release_date", e.target.value)} error={act.fields.release_date} disabled={!canEdit} />
          <TextField id="m-age" label="Age rating" value={f.age_rating} onChange={(e) => set("age_rating", e.target.value)} hint="e.g. 12, 15, 19" disabled={!canEdit} />
          <TextField id="m-rate" label="Score (0 to 10)" inputMode="decimal" value={f.rating} onChange={(e) => set("rating", e.target.value)} error={act.fields.rating} disabled={!canEdit} />
          <SelectField id="m-show" label="Showing" value={f.screening_status} onChange={(e) => set("screening_status", e.target.value)} disabled={!canEdit}>
            <option value="now_playing">Now playing</option>
            <option value="coming_soon">Coming soon</option>
          </SelectField>
          <TextField id="m-trailer" label="Trailer link (YouTube or Vimeo, https)" value={f.trailer_url} onChange={(e) => set("trailer_url", e.target.value)} error={act.fields.trailer_url} disabled={!canEdit} />
        </div>
        <TextArea id="m-desc" label="Synopsis" value={f.description} onChange={(e) => set("description", e.target.value)} error={act.fields.description} disabled={!canEdit} />
        <CheckField id="m-feat" label="Feature on the home page" checked={f.is_featured} onChange={(e) => set("is_featured", e.target.checked)} disabled={!canEdit} />

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Genres</legend>
          <div className="flex flex-wrap gap-2">
            {allGenres.map((g) => (
              <label key={g.slug} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${genres.includes(g.slug) ? "border-accent bg-accent/15" : "border-line"}`}>
                <input type="checkbox" className="sr-only" disabled={!canEdit} checked={genres.includes(g.slug)} onChange={() => setGenres((x) => (x.includes(g.slug) ? x.filter((s) => s !== g.slug) : [...x, g.slug]))} />
                {g.name}
              </label>
            ))}
          </div>
        </fieldset>

        <Repeater title="Cast" rows={cast} blank={{ name: "", role: "" }} fields={[["name", "Name"], ["role", "Character"]]} onChange={setCast} disabled={!canEdit} />
        <Repeater title="Crew" rows={crew} blank={{ name: "", job: "" }} fields={[["name", "Name"], ["job", "Job (director, writer…)"]]} onChange={setCrew} disabled={!canEdit} />

        <details className="rounded-control border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">Search engine details</summary>
          <div className="mt-3 grid gap-4">
            <TextField id="m-seot" label="SEO title" value={f.seo_title} onChange={(e) => set("seo_title", e.target.value)} disabled={!canEdit} />
            <TextArea id="m-seod" label="SEO description" value={f.seo_description} onChange={(e) => set("seo_description", e.target.value)} disabled={!canEdit} />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? <Button type="submit" disabled={act.busy}>{act.busy ? "Saving…" : movie ? "Save changes" : "Create draft"}</Button> : null}
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          {movie && can("movies.manage") ? (
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                if (window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) {
                  if (await act.run(() => adm.del(`/movies/${movie.id}`), "Movie deleted.")) {
                    onClose();
                    onSaved();
                  }
                }
              }}
              className="ml-auto text-rose-500 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="size-4 mr-1.5" />
              <span>Delete movie</span>
            </Button>
          ) : null}
        </div>
      </form>

      {movie ? (
        <div className="mt-6 grid gap-4 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={tone[movie.status]}>{movie.status}</Pill>
            {can("movies.publish") && movie.status !== "published" ? <Button size="sm" onClick={transition("publish", "Published.")} disabled={act.busy}>Publish</Button> : null}
            {can("movies.publish") && movie.status === "published" ? <Button size="sm" variant="secondary" onClick={transition("unpublish", "Moved back to draft.")} disabled={act.busy}>Unpublish</Button> : null}
            {can("movies.publish") && movie.status !== "archived" ? <Button size="sm" variant="secondary" onClick={transition("archive", "Archived.")} disabled={act.busy}>Archive</Button> : null}
          </div>
          {canEdit ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageSlot label="Poster" url={movie.poster_url} onPick={upload("poster")} />
              <ImageSlot label="Banner" url={movie.banner_url} onPick={upload("banner")} />
            </div>
          ) : null}
          <p className="text-xs text-muted">A movie needs a poster and a synopsis before it can be published.</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Save the draft first, then you can upload the poster and banner and publish.</p>
      )}
    </AdminModal>
  );
}

function ImageSlot({ label, url, onPick }: { label: string; url: string | null; onPick: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const id = `img-${label}`;
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image
        <img src={url} alt={`${label} preview`} className="mb-2 max-h-40 rounded-control border border-line object-cover" />
      ) : (
        <p className="mb-2 text-sm text-muted">No image yet.</p>
      )}
      <label htmlFor={id} className="inline-flex min-h-10 cursor-pointer items-center rounded-control border border-line px-3 text-sm font-semibold hover:border-accent">
        Upload {label.toLowerCase()}
      </label>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} />
    </div>
  );
}

function Repeater<T extends Record<string, string | null>>({ title, rows, blank, fields, onChange, disabled }: { title: string; rows: T[]; blank: T; fields: [keyof T & string, string][]; onChange: (r: T[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          {fields.map(([key, label]) => (
            <input key={key} aria-label={`${title} ${i + 1} ${label}`} placeholder={label} value={row[key] ?? ""} disabled={disabled} maxLength={120} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)))} className="h-11 rounded-control border border-line bg-background px-3 text-sm" />
          ))}
          <button type="button" aria-label={`Remove ${title} ${i + 1}`} disabled={disabled} className="grid size-11 place-items-center rounded-control border border-line text-muted hover:text-red-500" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || rows.length >= 40} onClick={() => onChange([...rows, { ...blank }])}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </div>
    </fieldset>
  );
}
