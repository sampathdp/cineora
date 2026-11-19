import { PageHero } from "@/components/ui/section-heading";
import { getSite } from "@/lib/api/content";
import { Paragraphs } from "./content-bits";

/**
 * Legal pages. If an administrator has written the text in the admin area (Settings), that text is shown.
 * Otherwise the factual defaults below describe what the system actually does. These defaults are a starting point
 * and must be reviewed by a lawyer before launch.
 */
export async function LegalPage({ pageKey, title, defaults }: { pageKey: "privacy" | "terms"; title: string; defaults: [string, string][] }) {
  const site = await getSite();
  const custom = site.pages[pageKey]?.trim();

  return (
    <>
      <PageHero title={title} eyebrow="Legal" />
      <section className="container-page max-w-3xl py-12">
        {custom ? (
          <Paragraphs items={custom.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)} />
        ) : (
          <div className="space-y-8">
            {defaults.map(([h, p]) => (
              <div key={h}>
                <h2 className="display text-2xl">{h}</h2>
                <p className="mt-2 text-muted">{p}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
