import { siteConfig } from "@/config/site";
import { API_BASE_URL, ApiError, apiPost } from "./client";

export interface SiteInfo {
  name: string;
  tagline: string;
  description: string;
  contact: { email: string; phone: string; address: string; hours: string | null };
  socials: { platform: string; url: string }[];
  pages: Record<string, string>;
}

export interface EventSummary {
  slug: string;
  title: string;
  image_url: string | null;
  is_featured: boolean;
  starts_at: string | null;
  ends_at: string | null;
  cinema: { slug: string; name: string; timezone: string } | null;
  summary: string;
  paragraphs?: string[];
  seo_description?: string | null;
}

export interface ArticleSummary {
  slug: string;
  title: string;
  excerpt: string;
  image_url: string | null;
  category: { slug: string; name: string } | null;
  published_at: string | null;
  paragraphs?: string[];
  seo_description?: string | null;
}

export interface PublicTestimonial {
  name: string;
  title: string | null;
  quote: string;
  rating: number;
}

async function get<T>(path: string, revalidate = 60): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, { headers: { Accept: "application/json" }, next: { revalidate } });
  } catch {
    throw new ApiError("Content is temporarily unavailable.", 0, "network");
  }
  if (!res.ok) throw new ApiError(res.status === 404 ? "Not found." : "Content is temporarily unavailable.", res.status);
  return ((await res.json()) as { data: T }).data;
}

/** Built-in site details, used until (or if) the API answers. */
export const siteFallback: SiteInfo = {
  name: siteConfig.name,
  tagline: siteConfig.tagline,
  description: siteConfig.description,
  contact: { ...siteConfig.contact, hours: null },
  socials: [],
  pages: {},
};

let siteRequest: Promise<SiteInfo> | null = null;

/** Website settings managed in the admin area, falling back to the built-in defaults if the API is unreachable. Fetched once per page load. */
export function getSite(): Promise<SiteInfo> {
  siteRequest ??= loadSite();
  return siteRequest;
}

async function loadSite(): Promise<SiteInfo> {
  const fallback = siteFallback;
  try {
    const d = await get<{ settings: Record<string, string | null>; social_links: { platform: string; url: string }[]; pages: Record<string, string> }>("/site");
    const s = d.settings;
    return {
      name: s["site.name"] || fallback.name,
      tagline: s["site.tagline"] || fallback.tagline,
      description: s["site.description"] || fallback.description,
      contact: {
        email: s["contact.email"] || fallback.contact.email,
        phone: s["contact.phone"] || fallback.contact.phone,
        address: s["contact.address"] || fallback.contact.address,
        hours: s["contact.hours"] || null,
      },
      socials: d.social_links,
      pages: d.pages,
    };
  } catch {
    return fallback;
  }
}

export const content = {
  events: () => get<EventSummary[]>("/events"),
  event: async (slug: string) => {
    try {
      return await get<EventSummary>(`/events/${encodeURIComponent(slug)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  articles: async () => (await get<ArticleSummary[]>("/articles?per_page=24")),
  article: async (slug: string) => {
    try {
      return await get<ArticleSummary>(`/articles/${encodeURIComponent(slug)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  testimonials: () => get<PublicTestimonial[]>("/testimonials", 120),
};

export const publicForms = {
  contact: (input: { name: string; email: string; subject: string; message: string; website?: string }) => apiPost<null>("/contact", input),
  newsletter: (email: string) => apiPost<null>("/newsletter", { email }),
};
