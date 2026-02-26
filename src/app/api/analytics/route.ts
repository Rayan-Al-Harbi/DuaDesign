import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "analytics.json");

interface Analytics {
  pageViews: number;
  duasGenerated: number;
  ttsPlays: number;
  dailyViews: Record<string, number>;
}

async function load(): Promise<Analytics> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { pageViews: 0, duasGenerated: 0, ttsPlays: 0, dailyViews: {} };
  }
}

async function save(data: Analytics) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// POST: track an event
export async function POST(req: NextRequest) {
  try {
    const { event } = await req.json();
    const data = await load();
    const today = new Date().toISOString().split("T")[0];

    if (event === "pageview") {
      data.pageViews++;
      data.dailyViews[today] = (data.dailyViews[today] || 0) + 1;
    } else if (event === "generate") {
      data.duasGenerated++;
    } else if (event === "tts") {
      data.ttsPlays++;
    }

    // Keep only last 90 days of daily views
    const keys = Object.keys(data.dailyViews).sort();
    if (keys.length > 90) {
      for (const k of keys.slice(0, keys.length - 90)) {
        delete data.dailyViews[k];
      }
    }

    await save(data);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// GET: retrieve analytics (for your eyes only — add auth if needed)
export async function GET() {
  const data = await load();
  return NextResponse.json(data);
}
