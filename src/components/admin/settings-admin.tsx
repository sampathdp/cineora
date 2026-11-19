"use client";

import { useState } from "react";
import { adm } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Feedback, PageTitle, Panel, Section, SelectField, TextArea, TextField, useAction, useLoad } from "./kit";

interface Settings { settings: Record<string, string | null>; social_links: { platform: string; url: string }[]; content: Record<string, string> }

const FIELDS: [string, string, string?][] = [
  ["site.name", "Site name"], ["site.tagline", "Tagline"], ["site.description", "Short description"],
  ["contact.email", "Contact email"], ["contact.phone", "Contact phone"], ["contact.address", "Address"], ["contact.hours", "Opening hours"],
];
const PLATFORMS = ["facebook", "instagram", "twitter", "youtube", "tiktok"];
const PAGES: [string, string][] = [["about", "About page"], ["terms", "Terms and conditions"], ["privacy", "Privacy policy"]];

export function SettingsAdmin() {
  const data = useLoad(() => adm.get<Settings>("/settings").then((r) => r.data), "settings");
  return (
    <section>
      <PageTitle
        title="Website & Portal Settings"
        eyebrow="System & Configuration"
        hint="Brand identity, contact metadata, social channel links, and legal page copy."
      />
      <Section loading={data.loading} error={data.error} data={data.data}>
        {(s) => (
          <div className="grid gap-6">
            <General initial={s.settings} onSaved={data.reload} />
            <Social initial={s.social_links} onSaved={data.reload} />
            <Pages initial={s.content} onSaved={data.reload} />
          </div>
        )}
      </Section>
    </section>
  );
}

function General({ initial, onSaved }: { initial: Settings["settings"]; onSaved: () => void }) {
  const act = useAction();
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map(([k]) => [k, initial[k] ?? ""])));
  return (
    <Panel title="Contact and branding">
      <form className="grid gap-4 sm:grid-cols-2" aria-label="Website settings" onSubmit={async (e) => { e.preventDefault(); if (await act.run(() => adm.put("/settings", { values: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || null])) }), "Saved.")) onSaved(); }}>
        <div className="sm:col-span-2"><Feedback error={act.error} note={act.note} /></div>
        {FIELDS.map(([k, label]) => <TextField key={k} id={`set-${k}`} label={label} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} error={act.fields[`values.${k}`] ?? act.fields.values} />)}
        <div className="sm:col-span-2"><Button type="submit" disabled={act.busy}>Save</Button></div>
      </form>
    </Panel>
  );
}

function Social({ initial, onSaved }: { initial: Settings["social_links"]; onSaved: () => void }) {
  const act = useAction();
  const [links, setLinks] = useState(PLATFORMS.map((p) => ({ platform: p, url: initial.find((l) => l.platform === p)?.url ?? "" })));
  return (
    <Panel title="Social links">
      <form className="grid gap-3" aria-label="Social links" onSubmit={async (e) => { e.preventDefault(); if (await act.run(() => adm.put("/settings/social-links", { links: links.filter((l) => l.url.trim()) }), "Saved.")) onSaved(); }}>
        <Feedback error={act.error} note={act.note} />
        {links.map((l, i) => (
          <div key={l.platform} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-end">
            <SelectField id={`sl-p-${i}`} label="Platform" value={l.platform} disabled><option>{l.platform}</option></SelectField>
            <TextField id={`sl-u-${i}`} label="Link (https only)" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" />
          </div>
        ))}
        <div><Button type="submit" disabled={act.busy}>Save links</Button></div>
      </form>
    </Panel>
  );
}

function Pages({ initial, onSaved }: { initial: Settings["content"]; onSaved: () => void }) {
  const [key, setKey] = useState(PAGES[0][0]);
  const [texts, setTexts] = useState<Record<string, string>>(Object.fromEntries(PAGES.map(([k]) => [k, initial[k] ?? ""])));
  const act = useAction();
  return (
    <Panel title="Page texts">
      <form className="grid gap-4" aria-label="Page text" onSubmit={async (e) => { e.preventDefault(); if (await act.run(() => adm.put(`/settings/content/${key}`, { body: texts[key] }), "Saved.")) onSaved(); }}>
        <Feedback error={act.error} note={act.note} />
        <SelectField id="pg-key" label="Page" value={key} onChange={(e) => setKey(e.target.value)}>{PAGES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</SelectField>
        <TextArea id="pg-body" label="Text" rows={12} value={texts[key]} onChange={(e) => setTexts({ ...texts, [key]: e.target.value })} error={act.fields.body} hint="Plain text, blank line between paragraphs. If empty, the website shows its built-in default text." />
        <div><Button type="submit" disabled={act.busy || !texts[key].trim()}>Save page</Button></div>
      </form>
    </Panel>
  );
}
