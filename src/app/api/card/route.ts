import { NextRequest, NextResponse } from "next/server";

/**
 * Generates a shareable dua image card as SVG (rendered to PNG by the client).
 * Returns an SVG string that the client converts to a downloadable image.
 */
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ success: false, error: "Invalid text" }, { status: 400 });
    }

    // Wrap text into lines (~60 chars per line for Arabic)
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > 60) {
        if (current) lines.push(current.trim());
        current = word;
      } else {
        current = (current + " " + word).trim();
      }
    }
    if (current.trim()) lines.push(current.trim());

    const lineHeight = 42;
    const paddingTop = 140;
    const paddingBottom = 80;
    const height = Math.max(550, paddingTop + lines.length * lineHeight + paddingBottom);
    const width = 900;

    // Escape XML special chars
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const textLines = lines.map((line, i) => {
      const y = paddingTop + i * lineHeight;
      return `<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="'Amiri', 'Noto Naskh Arabic', serif" font-size="22" fill="#ebe5d9" direction="rtl" xml:lang="ar">${esc(line)}</text>`;
    }).join("\n");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1226"/>
      <stop offset="100%" stop-color="#070b18"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="10%" r="50%">
      <stop offset="0%" stop-color="rgba(212,168,75,0.08)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="24"/>
  <rect width="${width}" height="${height}" fill="url(#glow)" rx="24"/>

  <!-- Top border -->
  <line x1="100" y1="20" x2="${width - 100}" y2="20" stroke="rgba(212,168,75,0.15)" stroke-width="0.5"/>

  <!-- Bismillah -->
  <text x="${width / 2}" y="60" text-anchor="middle" font-size="36" fill="#d4a84b" font-family="'Amiri', serif" opacity="0.9">﷽</text>

  <!-- Ornament -->
  <text x="${width / 2}" y="90" text-anchor="middle" font-size="10" fill="rgba(212,168,75,0.25)" letter-spacing="8">✦ ✦ ✦</text>

  <!-- Dua text -->
  ${textLines}

  <!-- Bottom border -->
  <line x1="100" y1="${height - 18}" x2="${width - 100}" y2="${height - 18}" stroke="rgba(212,168,75,0.15)" stroke-width="0.5"/>
</svg>`;

    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    console.error("[ImageCard]", e);
    return NextResponse.json({ success: false, error: "Failed to generate image" }, { status: 500 });
  }
}
