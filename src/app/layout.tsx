import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { DialogHost } from "@/components/ui/dialogs";
import { ThemeScript } from "@/providers/theme-script";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ConditionalFooter } from "@/components/layout/conditional-footer";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  ...(siteConfig.url ? { metadataBase: new URL(siteConfig.url), alternates: { canonical: "/" } } : {}),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} dark h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AuthProvider>
          <a
            href="#main"
            className="sr-only z-[200] rounded bg-accent px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <ConditionalFooter>
            <Footer />
          </ConditionalFooter>
          <DialogHost />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
