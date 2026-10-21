import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const items = [
  // Movie Backdrops for the 5 AI generated posters
  {
    target: "public/images/movies/ashes-of-the-lantern-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/the-glass-horizon-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/neon-requiem-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/paper-moons-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/the-last-tide-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1600&h=900&q=85",
  },

  // Remaining 9 Movie Posters & Backdrops
  {
    target: "public/images/movies/iron-meridian.jpg",
    url: "https://images.unsplash.com/photo-1541427468627-a89a96e5ca1d?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/iron-meridian-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/midnight-at-marlowe.jpg",
    url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/midnight-at-marlowe-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/wolf-season.jpg",
    url: "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/wolf-season-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/the-lemon-heist.jpg",
    url: "https://images.unsplash.com/photo-1587496679742-bad502958fbf?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/the-lemon-heist-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/little-comet.jpg",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/little-comet-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/ember-protocol.jpg",
    url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/ember-protocol-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/the-quiet-orchard.jpg",
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/the-quiet-orchard-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/crimson-carnival.jpg",
    url: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/crimson-carnival-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&fit=crop&w=1600&h=900&q=85",
  },
  {
    target: "public/images/movies/galaxy-garden.jpg",
    url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&h=1200&q=85",
  },
  {
    target: "public/images/movies/galaxy-garden-backdrop.jpg",
    url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1600&h=900&q=85",
  },




  // About and Intro
  {
    target: "public/images/about/cinema-about.jpg",
    url: "https://images.unsplash.com/photo-1595769816263-9b910be24d5f?auto=format&fit=crop&w=1200&h=900&q=85",
  },
  {
    target: "public/images/about/intro-1.jpg",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&h=1000&q=85",
  },
  {
    target: "public/images/about/intro-2.jpg",
    url: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=800&h=1000&q=85",
  },
];

async function downloadOne(item) {
  const fullPath = path.resolve(rootDir, item.target);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  // If already exists and size > 1000, skip unless it's a backdrop
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    if (stat.size > 20000) {
      console.log(`[SKIP] Already exists: ${item.target} (${stat.size} bytes)`);
      return;
    }
  }

  try {
    const res = await fetch(item.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);
    console.log(`[OK] Saved ${item.target} (${buffer.length} bytes)`);
  } catch (err) {
    console.error(`[ERROR] Failed to download ${item.target}:`, err.message);
  }
}

async function main() {
  console.log(`Starting download of ${items.length} image assets...`);
  for (const item of items) {
    await downloadOne(item);
  }
  console.log("All image downloads completed!");
}

main();
