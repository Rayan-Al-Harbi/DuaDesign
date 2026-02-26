import { NextRequest, NextResponse } from "next/server";
import { EdgeTTS } from "@andresaya/edge-tts";

const EDGE_VOICE = "ar-SA-HamedNeural";
const MAX_CHUNK = 190;

// ── Groq Orpheus (primary — higher quality) ──

function chunkText(text: string): string[] {
  const sentences = text.split(/(?<=[.،؛])\s*/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (s.length > MAX_CHUNK) {
      if (current) { chunks.push(current.trim()); current = ""; }
      const words = s.split(/\s+/);
      let wc = "";
      for (const w of words) {
        if ((wc + " " + w).trim().length > MAX_CHUNK) { if (wc) chunks.push(wc.trim()); wc = w; }
        else wc = (wc + " " + w).trim();
      }
      if (wc) current = wc;
    } else if ((current + " " + s).trim().length > MAX_CHUNK) {
      chunks.push(current.trim()); current = s;
    } else current = (current + " " + s).trim();
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 0);
}

async function groqChunk(text: string, apiKey: string): Promise<{ ok: boolean; data?: string; rateLimited?: boolean }> {
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "canopylabs/orpheus-arabic-saudi", input: text, voice: "fahad", response_format: "wav" }),
  });

  if (res.status === 429) return { ok: false, rateLimited: true };
  if (!res.ok) { console.error("[TTS:Groq]", res.status, await res.text()); return { ok: false }; }

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { ok: true, data: btoa(bin) };
}

async function tryGroq(text: string, apiKey: string): Promise<{ success: true; chunks: string[] } | { success: false }> {
  const chunks = chunkText(text);
  const audioChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[TTS:Groq] ${i + 1}/${chunks.length}: "${chunks[i].substring(0, 40)}..."`);
    const result = await groqChunk(chunks[i], apiKey);

    if (result.rateLimited) {
      console.warn("[TTS:Groq] Rate limited → falling back to Edge TTS");
      return { success: false };
    }
    if (!result.ok || !result.data) {
      console.warn("[TTS:Groq] Chunk failed → falling back to Edge TTS");
      return { success: false };
    }

    audioChunks.push(result.data);
  }

  return { success: true, chunks: audioChunks };
}

// ── Edge TTS (fallback — unlimited, free) ──

async function tryEdge(text: string): Promise<{ success: true; audio: string } | { success: false }> {
  try {
    const tts = new EdgeTTS();
    await tts.synthesize(text, EDGE_VOICE, { rate: "-10%", volume: "+0%", pitch: "-5Hz" });
    const audioBuffer = tts.toBuffer();

    if (!audioBuffer || audioBuffer.length === 0) {
      console.error("[TTS:Edge] Empty buffer");
      return { success: false };
    }

    const base64 = audioBuffer.toString("base64");
    console.log(`[TTS:Edge] ✓ ${Math.round(audioBuffer.length / 1024)}KB`);
    return { success: true, audio: base64 };
  } catch (e) {
    console.error("[TTS:Edge]", e);
    return { success: false };
  }
}

// ── Main handler ──

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.length < 10) {
      return NextResponse.json({ success: false, error: "نص غير صالح" }, { status: 400 });
    }

    const apiKey = process.env.LLM_API_KEY;

    // 1. Try Groq Orpheus first (higher quality Saudi voice)
    if (apiKey && apiKey !== "ollama") {
      console.log(`[TTS] Trying Groq Orpheus (${text.length} chars)`);
      const groqResult = await tryGroq(text, apiKey);

      if (groqResult.success) {
        console.log(`[TTS] ✓ Groq Orpheus: ${groqResult.chunks.length} chunks`);
        return NextResponse.json({ success: true, provider: "groq", chunks: groqResult.chunks });
      }
    }

    // 2. Fallback to Edge TTS (unlimited)
    console.log(`[TTS] Falling back to Edge TTS (${text.length} chars)`);
    const edgeResult = await tryEdge(text);

    if (edgeResult.success) {
      return NextResponse.json({ success: true, provider: "edge", audio: edgeResult.audio, format: "mp3" });
    }

    return NextResponse.json({ success: false, error: "فشل إنشاء الصوت" }, { status: 500 });
  } catch (e) {
    console.error("[TTS]", e);
    return NextResponse.json({ success: false, error: "فشل إنشاء الصوت" }, { status: 500 });
  }
}
