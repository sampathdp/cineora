"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { ArtSpec } from "@/types/art";
import { cn, hashString, seededRandom } from "@/lib/utils";

interface ArtProps {
  art: ArtSpec;
  /** Used for deterministic variation and as the accessible name. */
  seed: string;
  label?: string;
  className?: string;
  /** Print the title on the artwork, like a poster. */
  title?: string;
  variant?: "poster" | "backdrop" | "auto";
  priority?: boolean;
}

/**
 * Cinematic artwork component. Renders high-quality imagery when available,
 * with deterministic procedural SVG artwork fallback.
 */
export function Art({ art, seed, label, className, title, variant = "auto", priority }: ArtProps) {
  const [imgError, setImgError] = useState(false);
  const uid = useId().replace(/:/g, "");
  const { from, to, accent, motif } = art;

  const isWide =
    variant === "backdrop" ||
    (variant === "auto" &&
      (seed.endsWith("-banner") ||
        seed.endsWith("-trailer") ||
        seed.endsWith("-wide") ||
        seed.endsWith("-hero") ||
        seed.startsWith("intro-") ||
        seed === "about"));

  const imgSrc = !imgError && (isWide && art.backdrop ? art.backdrop : art.image || art.backdrop);
  // Wide images span the viewport; posters sit in grids. Wrong sizes make the browser download a tiny file.
  const sizes = isWide ? "100vw" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";

  // Wide slot but only a portrait poster: stretching it to cover crops most of it and blurs it.
  // Instead fill the slot with a blurred, darkened copy and show the whole poster on the right.
  if (imgSrc && isWide && !art.backdrop) {
    return (
      <div className={cn("relative block h-full w-full overflow-hidden bg-black", className)}>
        <Image
          src={imgSrc}
          alt=""
          aria-hidden
          fill
          sizes="50vw"
          priority={priority}
          className="scale-110 object-cover object-center opacity-60 blur-2xl"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-y-0 right-[6%] hidden w-full items-center justify-end md:flex">
          <div className="relative aspect-[2/3] h-[72%] max-h-[760px] overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
            <Image
              src={imgSrc}
              alt={label || title || seed}
              fill
              sizes="(max-width: 1200px) 40vw, 520px"
              priority={priority}
              className="object-cover"
            />
          </div>
        </div>
      </div>
    );
  }

  if (imgSrc) {
    const hasEmbeddedPosterTitle =
      art.image?.includes("ashes-of-the-lantern") ||
      art.image?.includes("the-glass-horizon") ||
      art.image?.includes("neon-requiem") ||
      art.image?.includes("paper-moons") ||
      art.image?.includes("the-last-tide");

    return (
      <div className={cn("relative block h-full w-full overflow-hidden", className)}>
        <Image
          src={imgSrc}
          alt={label || title || seed}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover object-center transition-transform duration-700"
          onError={() => setImgError(true)}
        />
        {title && !hasEmbeddedPosterTitle && !isWide ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-4 text-center">
            <span
              className="font-bold text-white tracking-widest uppercase text-base sm:text-lg drop-shadow-md"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {title.length > 20 ? title.split(" ").slice(0, 3).join(" ") : title}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.62" cy="0.3" r="0.6">
          <stop offset="0" stopColor={accent} stopOpacity="0.55" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`fade-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill={`url(#bg-${uid})`} />
      <rect width="400" height="600" fill={`url(#glow-${uid})`} />
      <Motif motif={motif} accent={accent} to={to} seed={seed} />
      <rect width="400" height="600" fill={`url(#fade-${uid})`} />
      {title ? (
        <text
          x="200"
          y="545"
          textAnchor="middle"
          fill="#fff"
          fontSize={title.length > 18 ? 26 : 32}
          fontWeight="700"
          letterSpacing="3"
          style={{ fontFamily: "var(--font-display), sans-serif", textTransform: "uppercase" }}
        >
          {title.length > 20 ? title.split(" ").slice(0, 3).join(" ") : title}
        </text>
      ) : null}
    </svg>
  );
}

function Motif({
  motif,
  accent,
  to,
  seed,
}: {
  motif: ArtSpec["motif"];
  accent: string;
  to: string;
  seed: string;
}) {
  // Created per render so double-invoked renders (StrictMode) stay deterministic.
  const rand = seededRandom(hashString(seed));
  switch (motif) {
    case "moon":
      return (
        <g>
          <circle cx="260" cy="190" r="74" fill={accent} opacity="0.92" />
          <circle cx="286" cy="176" r="64" fill={to} opacity="0.35" />
          <path d="M0 470 Q90 420 180 455 T400 440 V600 H0Z" fill="#000" opacity="0.7" />
          <path d="M0 520 Q120 480 230 515 T400 500 V600 H0Z" fill="#000" opacity="0.85" />
          <rect x="188" y="395" width="10" height="70" fill="#000" />
          <rect x="183" y="385" width="20" height="14" fill={accent} />
        </g>
      );
    case "mountains":
      return (
        <g>
          <circle cx="290" cy="210" r="46" fill={accent} opacity="0.85" />
          <polygon points="-20,470 90,300 170,400 250,260 330,380 420,300 420,600 -20,600" fill="#000" opacity="0.4" />
          <polygon points="-20,520 60,400 140,480 240,360 340,490 420,420 420,600 -20,600" fill="#000" opacity="0.7" />
        </g>
      );
    case "city": {
      const bars = Array.from({ length: 12 }, (_, i) => ({
        x: i * 36 - 6,
        h: 120 + Math.floor(rand() * 220),
        lit: rand() > 0.5,
      }));
      return (
        <g>
          {bars.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={600 - b.h - 40} width="32" height={b.h + 40} fill="#000" opacity="0.78" />
              {b.lit ? <rect x={b.x + 8} y={600 - b.h - 10} width="6" height="10" fill={accent} /> : null}
              <rect x={b.x + 18} y={600 - b.h + 30} width="6" height="6" fill={accent} opacity="0.7" />
            </g>
          ))}
          <rect y="560" width="400" height="40" fill={accent} opacity="0.18" />
        </g>
      );
    }
    case "sun":
      return (
        <g>
          <circle cx="200" cy="340" r="110" fill={accent} opacity="0.9" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x="60" y={380 + i * 14} width="280" height={2 + i} fill={to} opacity="0.85" />
          ))}
          <rect y="440" width="400" height="160" fill="#000" opacity="0.8" />
        </g>
      );
    case "stars": {
      const stars = Array.from({ length: 46 }, () => ({
        x: rand() * 400,
        y: rand() * 420,
        r: 0.8 + rand() * 2.2,
        o: 0.4 + rand() * 0.6,
      }));
      return (
        <g>
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
          ))}
          <circle cx="250" cy="220" r="70" fill={accent} opacity="0.95" />
          <circle cx="278" cy="204" r="62" fill={to} />
          <path d="M0 500 Q100 460 200 490 T400 470 V600 H0Z" fill="#000" opacity="0.6" />
        </g>
      );
    }
    case "waves":
      return (
        <g>
          <circle cx="270" cy="200" r="52" fill={accent} opacity="0.9" />
          {Array.from({ length: 6 }, (_, i) => {
            const y = 340 + i * 42;
            return (
              <path
                key={i}
                d={`M0 ${y} Q50 ${y - 22} 100 ${y} T200 ${y} T300 ${y} T400 ${y} V600 H0Z`}
                fill="#000"
                opacity={0.22 + i * 0.1}
              />
            );
          })}
        </g>
      );
    case "forest": {
      const trees = Array.from({ length: 14 }, (_, i) => ({
        x: i * 30 - 10 + rand() * 12,
        h: 120 + rand() * 170,
      }));
      return (
        <g>
          <circle cx="300" cy="170" r="42" fill={accent} opacity="0.8" />
          {trees.map((t, i) => (
            <polygon
              key={i}
              points={`${t.x},600 ${t.x + 22},${600 - t.h} ${t.x + 44},600`}
              fill="#000"
              opacity={0.55 + (i % 3) * 0.15}
            />
          ))}
        </g>
      );
    }
    case "door":
      return (
        <g>
          <path d="M130 600 V280 Q130 190 200 190 Q270 190 270 280 V600Z" fill={accent} opacity="0.95" />
          <path d="M150 600 V285 Q150 215 200 215 Q250 215 250 285 V600Z" fill="#fff" opacity="0.5" />
          <polygon points="150,600 250,600 380,600 20,600" fill="#000" />
          <rect y="520" width="400" height="80" fill="#000" opacity="0.85" />
        </g>
      );
    case "eye":
      return (
        <g>
          <ellipse cx="200" cy="260" rx="130" ry="64" fill="#000" opacity="0.55" />
          <circle cx="200" cy="260" r="52" fill={accent} opacity="0.95" />
          <circle cx="200" cy="260" r="22" fill="#000" />
          <circle cx="214" cy="248" r="7" fill="#fff" opacity="0.9" />
          <path d="M0 520 Q200 440 400 520 V600 H0Z" fill="#000" opacity="0.7" />
        </g>
      );
  }
}
