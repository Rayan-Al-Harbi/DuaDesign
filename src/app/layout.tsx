import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DuaDesign | اكتب ما في قلبك",
  description: "حوّل رغباتك إلى دعاء مستلهم من الأدعية المأثورة",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DuaDesign" },
  openGraph: { title: "دعاء — اكتب ما في قلبك", description: "حوّل رغباتك إلى دعاء مستلهم من الأدعية المأثورة", type: "website" },
  twitter: { card: "summary_large_image", title: "DuaDesign — اكتب ما في قلبك" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#070b18" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><link rel="apple-touch-icon" href="/icon-192.png" /></head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
