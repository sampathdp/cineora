"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clapperboard, Edit2, Film, Image as ImageIcon, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { apiGet } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { AdminModal, CheckField, DataTable, Feedback, PageTitle, Pill, Section, SelectField, TextArea, TextField, useAction, useLoad, when } from "./kit";
import { cn } from "@/lib/utils";
import { alertDialog, confirmDialog } from "@/components/ui/dialogs";

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
  const [editing, setEditing] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const open = (id: string | null) => {
    setCreatedId(null);
    setEditing(id);
  };

  const list = useLoad(
    () => adm.get<Movie[]>("/movies", { q, status, per_page: 50 }).then((r) => r.data),
    `movies-${q}-${status}`,
  );
  const genres = useLoad(
    () => apiGet<{ slug: string; name: string }[]>("/genres").then((r) => r.data),
    "genres",
  );

  const selected = list.data?.find((m) => m.id === editing) ?? null;

  return (
    <section className="space-y-6">
      <PageTitle
        title="Movies & Catalog"
        eyebrow="Cinema Operations"
        icon={Clapperboard}
        hint="Manage cinematic titles, poster artwork, synopsis, cast, crew, and screening distribution status."
        action={
          can("movies.manage") ? (
            <LinkButton href={routes.newMovie} className="shadow-sm">
              <Plus className="size-4 mr-1.5" aria-hidden />
              <span>New movie</span>
            </LinkButton>
          ) : undefined
        }
      />

      <Feedback error={act.error} note={act.note} />

      {/* Modern Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 rounded-2xl border border-line/70 bg-elevated/70 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex-1">
          <TextField
            id="mq"
            label="Search title"
            placeholder="Search by movie title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <SelectField
            id="ms"
            label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </SelectField>
        </div>
      </div>

      <Section loading={list.loading} error={list.error} data={list.data}>
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(m) => m.id}
            onRowClick={(m) => open(m.id)}
            empty="No movies match your filter."
            columns={[
              {
                key: "p",
                label: "Poster",
                className: "w-16",
                render: (m) => (
                  <div className="relative size-12 overflow-hidden rounded-xl border border-line/70 bg-surface/80 flex items-center justify-center">
                    {m.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.poster_url} alt={m.title} className="size-full object-cover" />
                    ) : (
                      <Film className="size-5 text-muted/40" />
                    )}
                  </div>
                ),
              },
              {
                key: "t",
                label: "Movie Details",
                render: (m) => (
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-left font-bold text-foreground hover:text-accent transition cursor-pointer"
                        onClick={() => open(m.id)}
                      >
                        {m.title}
                      </button>
                      {m.is_featured && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.2 text-[10px] font-bold text-amber-500">
                          <Star className="size-2.5 fill-amber-500" />
                          <span>Featured</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{m.duration_min} min</span>
                      <span>·</span>
                      <span className="capitalize">{m.screening_status.replace("_", " ")}</span>
                      {m.age_rating && (
                        <>
                          <span>·</span>
                          <span className="rounded border border-line/70 px-1 py-0.2 text-[10px] font-semibold">
                            {m.age_rating}+
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "g",
                label: "Genres",
                render: (m) => (
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {m.genres.slice(0, 2).map((g) => (
                      <span
                        key={g.slug}
                        className="rounded-full border border-line/60 bg-surface/60 px-2 py-0.5 text-[10px] text-muted font-medium"
                      >
                        {g.name}
                      </span>
                    ))}
                    {m.genres.length > 2 && (
                      <span className="text-[10px] text-muted self-center">
                        +{m.genres.length - 2}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "s",
                label: "Status",
                render: (m) => <Pill tone={tone[m.status]}>{m.status}</Pill>,
              },
              {
                key: "r",
                label: "Release",
                render: (m) => <span className="text-xs text-muted">{m.release_date ?? "—"}</span>,
              },
              {
                key: "u",
                label: "Updated",
                render: (m) => <span className="text-xs text-muted">{when(m.updated_at)}</span>,
              },
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
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer shadow-sm"
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
                        className="h-8 px-2.5 text-xs cursor-pointer border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
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
                          if ((await confirmDialog({ title: `Delete "${m.title}"?`, message: "This cannot be undone.", confirmLabel: "Delete movie", danger: true }))) {
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
        <MovieEditor
          key={editing === createdId ? "created" : editing}
          movie={selected}
          allGenres={genres.data ?? []}
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
    </section>
  );
}

/**
 * Full-page movie editor: /admin/movies/new/ to create, /admin/movies/edit/?id=… after the first save
 * (artwork uploads need a saved movie).
 */
export function MovieEditorPage() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const movie = useLoad(
    (signal) => (id ? adm.get<Movie>(`/movies/${encodeURIComponent(id)}`, undefined, signal).then((r) => r.data) : Promise.resolve(null)),
    `movie-${id ?? "new"}`,
    { cache: false },
  );
  const genres = useLoad(
    () => apiGet<{ slug: string; name: string }[]>("/genres").then((r) => r.data),
    "genres",
  );

  // Keep showing the last loaded copy while a reload after save is in flight, so the form does not flash away.
  const [last, setLast] = useState<Movie | null>(null);
  if (movie.data && movie.data !== last) setLast(movie.data);
  const current = movie.data ?? (last?.id === id ? last : null);

  if (id && !current) {
    return <p className="py-16 text-center text-sm text-muted">{movie.error ?? "Loading movie…"}</p>;
  }

  return (
    <MovieEditor
      key={id ?? "new"}
      asPage
      movie={current}
      allGenres={genres.data ?? []}
      onClose={() => router.push("/admin/movies/")}
      onSaved={(savedId, saved) => {
        if (savedId && savedId !== id) router.replace(routes.editMovie(savedId));
        // Save responses already carry the full updated movie: show it instead of fetching it again.
        else if (saved) movie.set(saved);
        else movie.reload();
      }}
    />
  );
}

function PageShell({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  return (
    <section className="space-y-6">
      <Link
        href="/admin/movies/"
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-accent-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to movies
      </Link>
      <PageTitle title={title} eyebrow="Movies & Catalog" icon={Clapperboard} hint={subtitle} />
      <div className="rounded-2xl border border-line/80 bg-elevated p-5 sm:p-6">{children}</div>
    </section>
  );
}

function MovieEditor({
  movie,
  allGenres,
  onClose,
  onSaved,
  asPage = false,
}: {
  movie: Movie | null;
  allGenres: { slug: string; name: string }[];
  onClose: () => void;
  onSaved: (id?: string, saved?: Movie) => void;
  asPage?: boolean;
}) {
  const { can } = useAuth();
  const act = useAction();
  const [f, setF] = useState({
    title: movie?.title ?? "",
    tagline: movie?.tagline ?? "",
    description: movie?.description ?? "",
    duration_min: String(movie?.duration_min ?? 110),
    release_date: movie?.release_date ?? "",
    age_rating: movie?.age_rating ?? "",
    screening_status: movie?.screening_status ?? "coming_soon",
    is_featured: movie?.is_featured ?? false,
    trailer_url: movie?.trailer_url ?? "",
    seo_title: movie?.seo_title ?? "",
    seo_description: movie?.seo_description ?? "",
  });
  const [genres, setGenres] = useState<string[]>(movie?.genres.map((g) => g.slug) ?? []);
  const [cast, setCast] = useState(movie?.cast ?? []);
  const [crew, setCrew] = useState(movie?.crew ?? []);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const canEdit = can("movies.manage");
  // New movies: artwork is picked up front and uploaded right after the movie is created.
  const [files, setFiles] = useState<{ poster?: { file: File; url: string }; banner?: { file: File; url: string } }>({});
  const [checkError, setCheckError] = useState<string | null>(null);
  const pick = (kind: "poster" | "banner") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFiles((x) => {
      if (x[kind]) URL.revokeObjectURL(x[kind].url);
      return { ...x, [kind]: { file, url: URL.createObjectURL(file) } };
    });
  };

  async function save(e: React.FormEvent | React.MouseEvent, publish = false) {
    e.preventDefault();
    setCheckError(null);
    if (!movie && publish && (!files.poster || !f.description.trim())) {
      setCheckError("To publish now, add a synopsis and a poster. Or save as a draft and finish later.");
      return;
    }
    const body = {
      ...f,
      duration_min: Number(f.duration_min),
      release_date: f.release_date || null,
      tagline: f.tagline || null,
      description: f.description || null,
      age_rating: f.age_rating || null,
      trailer_url: f.trailer_url || null,
      seo_title: f.seo_title || null,
      seo_description: f.seo_description || null,
      genres,
      cast: cast.filter((c) => c.name.trim()),
      crew: crew.filter((c) => c.name.trim() && c.job.trim()),
    };
    if (movie) {
      const r = await act.run(() => adm.patch<Movie>(`/movies/${movie.id}`, body), "Saved.");
      if (r) onSaved(r.data.id, r.data);
      return;
    }

    // Create, upload artwork and (optionally) publish in one go.
    let createdId: string | undefined;
    const r = await act.run(async () => {
      const created = await adm.post<Movie>("/movies", body);
      createdId = created.data.id;
      // Poster and banner are independent uploads: send them together instead of one after the other.
      const id = createdId;
      await Promise.all(
        (["poster", "banner"] as const).flatMap((kind) => {
          const picked = files[kind];
          return picked ? [adm.upload(`/movies/${id}/images/${kind}`, picked.file)] : [];
        }),
      );
      if (publish) await adm.post(`/movies/${createdId}/publish`);
      return created;
    }, publish ? "Published." : "Saved as draft.");
    if (r) onSaved(r.data.id);
    else if (createdId) {
      // The movie exists now; never leave the form open to create it a second time.
      await alertDialog({ title: "Saved as draft", message: "The movie was saved, but uploading the artwork or publishing did not finish. Please check it on the next screen." });
      onSaved(createdId);
    }
  }

  const transition = (what: "publish" | "unpublish" | "archive", ok: string) => async () => {
    if (!movie) return;
    if ((what === "archive" || what === "unpublish") && !(await confirmDialog({ title: `${what === "archive" ? "Archive" : "Unpublish"} this movie?`, message: what === "archive" ? "It is hidden from the site and cannot get new showtimes." : "It is hidden from the site until you publish it again.", confirmLabel: what === "archive" ? "Archive" : "Unpublish", danger: true }))) return;
    const r = await act.run(() => adm.post<Movie>(`/movies/${movie.id}/${what}`), ok);
    if (r) onSaved(r.data.id, r.data);
  };

  const upload = (kind: "poster" | "banner") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!movie || !file) return;
    const r = await act.run(() => adm.upload<Movie>(`/movies/${movie.id}/images/${kind}`, file), `${kind} updated.`);
    if (r) onSaved(r.data.id, r.data);
  };

  const Shell = asPage ? PageShell : ModalShell;
  return (
    <Shell
      onClose={onClose}
      title={movie ? `Edit: ${movie.title}` : "New Movie Title"}
      subtitle="Catalog metadata, genres, cast, crew, artwork, and screening distribution"
    >
      <form onSubmit={save} noValidate className="space-y-6" aria-label="Movie form">
        <Feedback error={act.error} note={act.note} />

        {/* General Details Section */}
        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <Film className="size-3.5 text-accent" />
            <span>Essential Metadata</span>
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="m-title"
              label="Title"
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              error={act.fields.title}
              disabled={!canEdit}
            />
            <TextField
              id="m-tag"
              label="Tagline"
              value={f.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              disabled={!canEdit}
            />
            <TextField
              id="m-dur"
              label="Duration (minutes)"
              inputMode="numeric"
              value={f.duration_min}
              onChange={(e) => set("duration_min", e.target.value)}
              error={act.fields.duration_min}
              disabled={!canEdit}
            />
            <TextField
              id="m-rel"
              label="Release date"
              type="date"
              value={f.release_date}
              onChange={(e) => set("release_date", e.target.value)}
              error={act.fields.release_date}
              disabled={!canEdit}
            />
            <TextField
              id="m-age"
              label="Age rating"
              value={f.age_rating}
              onChange={(e) => set("age_rating", e.target.value)}
              hint="e.g. 12, 15, 18, ALL"
              disabled={!canEdit}
            />
            <SelectField
              id="m-show"
              label="Screening Status"
              value={f.screening_status}
              onChange={(e) => set("screening_status", e.target.value)}
              disabled={!canEdit}
            >
              <option value="now_playing">Now playing</option>
              <option value="coming_soon">Coming soon</option>
            </SelectField>
            <TextField
              id="m-trailer"
              label="Trailer URL (YouTube or Vimeo embed)"
              value={f.trailer_url}
              onChange={(e) => set("trailer_url", e.target.value)}
              error={act.fields.trailer_url}
              disabled={!canEdit}
            />
          </div>

          <TextArea
            id="m-desc"
            label="Synopsis"
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            error={act.fields.description}
            disabled={!canEdit}
          />

          <div className="pt-1">
            <CheckField
              id="m-feat"
              label="Feature prominently on consumer home page carousel"
              checked={f.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Genres Selection */}
        <div className="rounded-2xl border border-line/60 bg-surface/40 p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Genres & Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            {allGenres.map((g) => {
              const active = genres.includes(g.slug);
              return (
                <label
                  key={g.slug}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                    active
                      ? "border-accent bg-accent/15 text-accent shadow-sm"
                      : "border-line/70 bg-elevated/70 text-muted hover:border-line hover:text-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    disabled={!canEdit}
                    checked={active}
                    onChange={() =>
                      setGenres((x) =>
                        x.includes(g.slug) ? x.filter((s) => s !== g.slug) : [...x, g.slug],
                      )
                    }
                  />
                  <span>{g.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Cast & Crew Repeaters */}
        <div className="space-y-4">
          <Repeater
            title="Cast Members"
            rows={cast}
            blank={{ name: "", role: "" }}
            fields={[
              ["name", "Actor Name"],
              ["role", "Character / Role"],
            ]}
            onChange={setCast}
            disabled={!canEdit}
          />
          <Repeater
            title="Production Crew"
            rows={crew}
            blank={{ name: "", job: "" }}
            fields={[
              ["name", "Crew Member Name"],
              ["job", "Role (Director, Writer, Producer)"],
            ]}
            onChange={setCrew}
            disabled={!canEdit}
          />
        </div>

        {/* SEO Details */}
        <details className="rounded-2xl border border-line/60 bg-surface/30 p-4 transition">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted hover:text-foreground">
            Search Engine Optimization (SEO)
          </summary>
          <div className="mt-4 grid gap-4">
            <TextField
              id="m-seot"
              label="SEO Title"
              value={f.seo_title}
              onChange={(e) => set("seo_title", e.target.value)}
              disabled={!canEdit}
            />
            <TextArea
              id="m-seod"
              label="SEO Description"
              value={f.seo_description}
              onChange={(e) => set("seo_description", e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </details>

        {!movie && canEdit && (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageSlot label="Poster Artwork (Portrait)" url={files.poster?.url ?? null} onPick={pick("poster")} />
              <ImageSlot label="Banner Artwork (Landscape)" url={files.banner?.url ?? null} onPick={pick("banner")} />
            </div>
            <p className="text-[11px] text-muted">A synopsis and a poster are needed to publish. The banner is optional.</p>
          </div>
        )}

        {checkError && <p className="text-sm text-rose-500">{checkError}</p>}

        {/* Form Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
          <div className="flex items-center gap-2.5">
            {!movie && canEdit && can("movies.publish") && (
              <Button type="button" onClick={(e) => save(e, true)} disabled={act.busy} className="shadow-sm">
                {act.busy ? "Working…" : "Publish Movie"}
              </Button>
            )}
            {canEdit && (
              <Button type="submit" variant={movie || !can("movies.publish") ? "primary" : "secondary"} disabled={act.busy} className="shadow-sm">
                {act.busy ? "Saving…" : movie ? "Save Changes" : "Save as Draft"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
              Close
            </Button>
          </div>

          {movie && can("movies.manage") && (
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                if ((await confirmDialog({ title: `Delete "${movie.title}"?`, message: "This cannot be undone.", confirmLabel: "Delete movie", danger: true }))) {
                  if (await act.run(() => adm.del(`/movies/${movie.id}`), "Movie deleted.")) {
                    onClose();
                    onSaved();
                  }
                }
              }}
              className="text-rose-500 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="size-4 mr-1.5" />
              <span>Delete Title</span>
            </Button>
          )}
        </div>
      </form>

      {/* Poster & Banner Upload Section (Available after creating draft) */}
      {movie ? (
        <div className="mt-8 rounded-2xl border border-line/70 bg-surface/50 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-3">
            <div className="flex items-center gap-2">
              <Pill tone={tone[movie.status]}>{movie.status}</Pill>
              <span className="text-xs text-muted">Screening Life Cycle</span>
            </div>

            <div className="flex items-center gap-2">
              {can("movies.publish") && movie.status !== "published" && (
                <Button size="sm" onClick={transition("publish", "Published.")} disabled={act.busy}>
                  Publish Movie
                </Button>
              )}
              {can("movies.publish") && movie.status === "published" && (
                <Button size="sm" variant="secondary" onClick={transition("unpublish", "Moved back to draft.")} disabled={act.busy}>
                  Unpublish
                </Button>
              )}
              {can("movies.publish") && movie.status !== "archived" && (
                <Button size="sm" variant="secondary" onClick={transition("archive", "Archived.")} disabled={act.busy}>
                  Archive
                </Button>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageSlot label="Poster Artwork (Portrait)" url={movie.poster_url} onPick={upload("poster")} />
              <ImageSlot label="Banner Artwork (Landscape)" url={movie.banner_url} onPick={upload("banner")} />
            </div>
          )}
          <p className="text-[11px] text-muted">
            Note: A title requires at least a verified poster artwork and synopsis before it can be published live.
          </p>
        </div>
      ) : null}
    </Shell>
  );
}

function ModalShell({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  return (
    <AdminModal open onClose={onClose} title={title} subtitle={subtitle} size="xl">
      {children}
    </AdminModal>
  );
}

function ImageSlot({
  label,
  url,
  onPick,
}: {
  label: string;
  url: string | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = `img-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="rounded-xl border border-line/60 bg-elevated/70 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      {url ? (
        <div className="relative mb-3 max-h-48 overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${label} preview`} className="size-full max-h-48 object-cover" />
        </div>
      ) : (
        <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-line/70 bg-surface/50 text-muted">
          <ImageIcon className="size-8 opacity-40" />
        </div>
      )}
      <label
        htmlFor={id}
        className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border border-line/80 bg-surface px-3 text-xs font-semibold hover:border-accent hover:text-accent transition shadow-sm w-full"
      >
        Upload {label.split(" ")[0]}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onPick}
      />
    </div>
  );
}

function Repeater<T extends Record<string, string | null>>({
  title,
  rows,
  blank,
  fields,
  onChange,
  disabled,
}: {
  title: string;
  rows: T[];
  blank: T;
  fields: [keyof T & string, string][];
  onChange: (r: T[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line/60 bg-surface/40 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">{title} ({rows.length})</h4>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || rows.length >= 40}
          onClick={() => onChange([...rows, { ...blank }])}
          className="h-8 text-xs cursor-pointer"
        >
          <Plus className="size-3 mr-1" aria-hidden />
          <span>Add</span>
        </Button>
      </div>

      {rows.map((row, i) => (
        <div key={i} className="flex flex-col sm:flex-row items-center gap-2">
          {fields.map(([key, label]) => (
            <input
              key={key}
              aria-label={`${title} ${i + 1} ${label}`}
              placeholder={label}
              value={row[key] ?? ""}
              disabled={disabled}
              maxLength={120}
              onChange={(e) =>
                onChange(rows.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)))
              }
              className="h-10 w-full rounded-xl border border-line/70 bg-background/90 px-3 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          ))}
          <button
            type="button"
            aria-label={`Remove ${title} ${i + 1}`}
            disabled={disabled}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line/70 text-muted hover:border-rose-500 hover:text-rose-500 transition cursor-pointer"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-xs italic text-muted py-1">No entries added yet.</p>
      )}
    </div>
  );
}
