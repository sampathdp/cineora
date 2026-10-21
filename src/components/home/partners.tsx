/** CSS-only placeholder marks. Not real company logos. */
const marks = [
  { name: "Northwind", shape: "rounded-full" },
  { name: "Lumen & Co", shape: "rotate-45 rounded-sm" },
  { name: "Aperture", shape: "rounded-md" },
  { name: "Helio", shape: "rounded-full border-4 bg-transparent" },
  { name: "Quartz", shape: "rotate-45" },
];

export function Partners() {
  return (
    <section className="border-y border-line py-12" aria-label="Partners (placeholder logos)">
      <ul className="container-page flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-70 grayscale">
        {marks.map((m) => (
          <li key={m.name} className="flex items-center gap-3">
            <span aria-hidden className={`block size-7 bg-foreground ${m.shape} border-foreground`} />
            <span className="display text-xl tracking-[0.18em]">{m.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
