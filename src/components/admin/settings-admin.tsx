"use client";

import { useState } from "react";
import { Building, Globe, HelpCircle, Info, Link2, Settings, ShieldCheck } from "lucide-react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Feedback, PageTitle, Panel, Section, SelectField, TextArea, TextField, useAction, useLoad } from "./kit";

interface SettingsData {
  settings: Record<string, string | null>;
  social_links: { platform: string; url: string }[];
  content: Record<string, string>;
}

const FIELDS: [string, string, string?][] = [
  ["site.name", "Site Brand Name", "Displayed in browser headers and emails"],
  ["site.tagline", "Brand Tagline", "Short marketing slogan"],
  ["site.description", "Short Meta Description", "Search engine snippet"],
  ["contact.email", "Support Contact Email", "Public support inquiries"],
  ["contact.phone", "Box Office Telephone", "Customer telephone support"],
  ["contact.address", "Headquarters Address", "Official corporate address"],
  ["contact.hours", "Operating Box Office Hours", "e.g. 09:00 - 23:00 KST"],
];

const PLATFORMS = ["facebook", "instagram", "twitter", "youtube", "tiktok"];
const PAGES: [string, string][] = [
  ["about", "About Us Page"],
  ["terms", "Terms of Service"],
  ["privacy", "Privacy Policy"],
];

export function SettingsAdmin() {
  const data = useLoad(() => adm.get<SettingsData>("/settings").then((r) => r.data), "settings", { cache: false });

  return (
    <section className="space-y-6">
      <PageTitle
        title="Website & Portal Settings"
        eyebrow="System & Configuration"
        icon={Settings}
        hint="Brand identity, corporate contact metadata, social media channel links, and legal disclosure copy."
      />

      <Section loading={data.loading} error={data.error} data={data.data}>
        {(s) => (
          <div className="space-y-6">
            <General initial={s.settings} onSaved={data.reload} />
            <Social initial={s.social_links} onSaved={data.reload} />
            <Pages initial={s.content} onSaved={data.reload} />
          </div>
        )}
      </Section>
    </section>
  );
}

function General({ initial, onSaved }: { initial: SettingsData["settings"]; onSaved: () => void }) {
  const act = useAction();
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(([k]) => [k, initial[k] ?? ""])),
  );

  return (
    <Panel title="Brand Identity & Contact Details" icon={Building}>
      <form
        className="space-y-5"
        aria-label="Website settings"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act.run(
              () =>
                adm.put("/settings", {
                  values: Object.fromEntries(
                    Object.entries(v).map(([k, x]) => [k, x.trim() || null]),
                  ),
                }),
              "Brand settings saved successfully.",
            )
          ) {
            onSaved();
          }
        }}
      >
        <Feedback error={act.error} note={act.note} />
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([k, label, hint]) => (
            <TextField
              key={k}
              id={`set-${k}`}
              label={label}
              hint={hint}
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              error={act.fields[`values.${k}`] ?? act.fields.values}
            />
          ))}
        </div>
        <div className="pt-2 border-t border-line/40">
          <Button type="submit" disabled={act.busy} className="shadow-sm">
            {act.busy ? "Saving…" : "Save Brand Settings"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Social({ initial, onSaved }: { initial: SettingsData["social_links"]; onSaved: () => void }) {
  const act = useAction();
  const [links, setLinks] = useState(
    PLATFORMS.map((p) => ({
      platform: p,
      url: initial.find((l) => l.platform === p)?.url ?? "",
    })),
  );

  return (
    <Panel title="Social Channels & External Links" icon={Globe}>
      <form
        className="space-y-4"
        aria-label="Social links"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act.run(
              () =>
                adm.put("/settings/social-links", {
                  links: links.filter((l) => l.url.trim()),
                }),
              "Social links saved.",
            )
          ) {
            onSaved();
          }
        }}
      >
        <Feedback error={act.error} note={act.note} />
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((l, i) => (
            <div key={l.platform} className="rounded-xl border border-line/60 bg-surface/40 p-3">
              <TextField
                id={`sl-u-${i}`}
                label={`${l.platform.toUpperCase()} URL`}
                value={l.url}
                onChange={(e) =>
                  setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                }
                placeholder="https://"
              />
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-line/40">
          <Button type="submit" disabled={act.busy} className="shadow-sm">
            {act.busy ? "Saving…" : "Save Social Links"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Pages({ initial, onSaved }: { initial: SettingsData["content"]; onSaved: () => void }) {
  const [key, setKey] = useState(PAGES[0][0]);
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(PAGES.map(([k]) => [k, initial[k] ?? ""])),
  );
  const act = useAction();

  return (
    <Panel title="Legal Disclosures & Policy Content" icon={ShieldCheck}>
      <form
        className="space-y-4"
        aria-label="Page text"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act.run(
              () => adm.put(`/settings/content/${key}`, { body: texts[key] }),
              "Legal page copy saved.",
            )
          ) {
            onSaved();
          }
        }}
      >
        <Feedback error={act.error} note={act.note} />

        <div className="max-w-xs">
          <SelectField
            id="pg-key"
            label="Select Document to Edit"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          >
            {PAGES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>

        <TextArea
          id="pg-body"
          label="Document Body Text"
          rows={12}
          value={texts[key]}
          onChange={(e) => setTexts({ ...texts, [key]: e.target.value })}
          error={act.fields.body}
          hint="Formatted plain text. Leave a blank line between paragraphs. When left empty, Cineora renders the built-in default policy text."
        />

        <div className="pt-2 border-t border-line/40">
          <Button type="submit" disabled={act.busy || !texts[key].trim()} className="shadow-sm">
            {act.busy ? "Saving…" : `Save ${PAGES.find(([k]) => k === key)?.[1]}`}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
