"use client";
import { useState, useCallback, useRef } from "react";
import type { GeneratedDua } from "@/types/dua";

interface Props { dua: GeneratedDua; onRegenerate?: () => void; isRegenerating?: boolean; }

// In-memory cache: dua text hash → blob URL
const audioCache = new Map<string, { url: string; type: "mp3" | "wav-chunks"; chunks?: string[] }>();

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) { h = ((h << 5) - h + text.charCodeAt(i)) | 0; }
  return h.toString(36);
}

function b64toBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function DuaDisplay({ dua, onRegenerate, isRegenerating }: Props) {
  const [copied, setCopied] = useState(false);
  const [ttsState, setTtsState] = useState<"idle"|"loading"|"playing"|"error">("idle");
  const [cardLoading, setCardLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const chunksRef = useRef<string[]>([]);
  const chunkIdxRef = useRef(0);
  const stoppedRef = useRef(false);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(dua.text); }
    catch { const t = document.createElement("textarea"); t.value = dua.text; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }, [dua.text]);

  const share = useCallback(async () => {
    if (navigator.share) { try { await navigator.share({ title: "دعاء", text: dua.text }); return; } catch {} }
    copy();
  }, [dua.text, copy]);

  // ── Play single MP3 (Edge TTS) ──
  const playMp3 = useCallback((url: string) => {
    stoppedRef.current = false;
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setTtsState("idle");
    a.onerror = () => { setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000); };
    setTtsState("playing");
    a.play().catch(() => { setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000); });
  }, []);

  // ── Play chunked WAV (Groq Orpheus) ──
  const playNextChunk = useCallback(() => {
    if (stoppedRef.current) return;
    const idx = chunkIdxRef.current;
    if (idx >= chunksRef.current.length) { setTtsState("idle"); return; }
    const blob = b64toBlob(chunksRef.current[idx], "audio/wav");
    const url = URL.createObjectURL(blob);
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => { URL.revokeObjectURL(url); chunkIdxRef.current++; playNextChunk(); };
    a.onerror = () => { URL.revokeObjectURL(url); setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000); };
    a.play().catch(() => { setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000); });
  }, []);

  const playChunks = useCallback((chunks: string[]) => {
    stoppedRef.current = false;
    chunksRef.current = chunks;
    chunkIdxRef.current = 0;
    setTtsState("playing");
    playNextChunk();
  }, [playNextChunk]);

  // ── Main TTS handler ──
  const playTTS = useCallback(async () => {
    if (ttsState === "playing") {
      stoppedRef.current = true;
      if (audioRef.current) audioRef.current.pause();
      setTtsState("idle"); return;
    }

    const cacheKey = hashText(dua.text);

    // Check cache — instant replay
    const cached = audioCache.get(cacheKey);
    if (cached) {
      if (cached.type === "mp3") {
        playMp3(cached.url);
      } else if (cached.chunks) {
        playChunks(cached.chunks);
      }
      return;
    }

    // Generate new audio
    setTtsState("loading");
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: dua.text }) });
      const d = await r.json();
      if (!d.success) { setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000); return; }

      fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "tts" }) }).catch(() => {});

      if (d.provider === "groq" && d.chunks) {
        // Groq Orpheus — chunked WAV
        audioCache.set(cacheKey, { url: "", type: "wav-chunks", chunks: d.chunks });
        playChunks(d.chunks);
      } else if (d.audio) {
        // Edge TTS — single MP3
        const blob = b64toBlob(d.audio, "audio/mpeg");
        const url = URL.createObjectURL(blob);
        audioCache.set(cacheKey, { url, type: "mp3" });
        playMp3(url);
      } else {
        setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000);
      }
    } catch { setTtsState("error"); setTimeout(() => setTtsState("idle"), 3000); }
  }, [dua.text, ttsState, playMp3, playChunks]);

  // ── Image Card ──
  const downloadCard = useCallback(async () => {
    setCardLoading(true);
    try {
      const r = await fetch("/api/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: dua.text }) });
      const svgText = await r.text();
      const img = new Image();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * 2;
        canvas.height = img.naturalHeight * 2;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(pngBlob);
          a.download = "dua-card.png";
          a.click();
          URL.revokeObjectURL(a.href);
          setCardLoading(false);
        }, "image/png");
      };
      img.onerror = () => { setCardLoading(false); };
      img.src = url;
    } catch { setCardLoading(false); }
  }, [dua.text]);

  const paragraphs = dua.text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);

  const ttsLabel: Record<string, string> = {
    idle: "🔊 استمع",
    loading: "⏳ جاري التحميل...",
    playing: "⏹ إيقاف",
    error: "⚠ حاول مجدداً",
  };

  return (
    <div className="dd">
      <div className="arch"><svg viewBox="0 0 400 40" className="asvg"><path d="M0,40 Q200,-8 400,40" fill="none" stroke="rgba(212,168,75,.2)" strokeWidth="1"/><path d="M30,40 Q200,2 370,40" fill="none" stroke="rgba(212,168,75,.1)" strokeWidth=".5"/></svg></div>
      <div className="hdr"><div className="bsm">﷽</div><div className="horn">✦ ✦ ✦</div></div>
      <div className="body">{paragraphs.map((p, i) => <p key={i} className="dp">{p}</p>)}</div>

      <div className="acts">
        <button onClick={playTTS} disabled={ttsState === "loading"} className={`ab tb ${ttsState === "playing" ? "playing" : ""}`}>{ttsLabel[ttsState]}</button>
        <button onClick={copy} className="ab">{copied ? "✓ تم" : "⧉ نسخ"}</button>
        <button onClick={share} className="ab">↗ مشاركة</button>
        <button onClick={downloadCard} disabled={cardLoading} className="ab">{cardLoading ? "⏳ جاري..." : "🖼 صورة"}</button>
        {onRegenerate && <button onClick={onRegenerate} disabled={isRegenerating} className="ab"><span className={isRegenerating ? "spin" : ""}>⟳</span> {isRegenerating ? "جاري..." : "إعادة"}</button>}
      </div>

      <style jsx>{`
        .dd{background:linear-gradient(170deg,rgba(13,18,42,.85),rgba(7,11,24,.95));border:1px solid rgba(212,168,75,.12);border-radius:24px;overflow:hidden;animation:fiu .7s ease-out;backdrop-filter:blur(12px)}
        @keyframes fiu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .arch{width:100%;height:28px;overflow:hidden;display:flex;justify-content:center;padding-top:6px}
        .asvg{width:80%;height:40px}
        .hdr{text-align:center;padding:.4rem 1.5rem .5rem}
        .cres{font-size:1.6rem;color:var(--gold);opacity:.6;filter:drop-shadow(0 0 10px rgba(212,168,75,.25));margin-bottom:.15rem}
        .bsm{font-size:2.1rem;color:var(--gold);line-height:1.4;filter:drop-shadow(0 0 12px rgba(212,168,75,.12))}
        .horn{color:rgba(212,168,75,.18);font-size:.45rem;letter-spacing:.8em;margin-top:.4rem}
        .body{padding:.25rem 2rem 1rem;direction:rtl}
        .dp{font-family:"Amiri","Noto Naskh Arabic",serif;font-size:1.2rem;line-height:2.4;color:var(--txt);text-align:center;margin:0 0 .75rem}
        .dp:last-child{margin-bottom:0}
        .orn{display:flex;justify-content:center;align-items:center;gap:.5rem;padding:.3rem 0 .5rem;color:rgba(212,168,75,.22);font-size:1rem}
        .od{font-size:.6rem}
        .acts{display:flex;justify-content:center;gap:.4rem;padding:.25rem 1rem 1.4rem;flex-wrap:wrap}
        .ab{display:flex;align-items:center;gap:.3rem;background:rgba(212,168,75,.06);border:1px solid rgba(212,168,75,.12);color:var(--gold-d);padding:.42rem .75rem;border-radius:10px;font-size:.73rem;font-family:"IBM Plex Sans Arabic",sans-serif;cursor:pointer;transition:all .25s ease;direction:rtl}
        .ab:hover{background:rgba(212,168,75,.12);border-color:rgba(212,168,75,.25);color:var(--gold)}
        .ab:disabled{opacity:.5;cursor:not-allowed}
        .tb{background:rgba(212,168,75,.1);border-color:rgba(212,168,75,.2)}
        .tb.playing{background:rgba(212,168,75,.18);border-color:var(--gold-d);color:var(--gold);box-shadow:0 0 15px rgba(212,168,75,.15)}
        .spin{animation:sp .8s linear infinite;display:inline-block}
        @keyframes sp{to{transform:rotate(360deg)}}
        @media(max-width:640px){.body{padding:.25rem 1.25rem 1rem}.dp{font-size:1.05rem;line-height:2.2}.bsm{font-size:1.7rem}.acts{gap:.3rem;padding:.2rem .6rem 1.2rem}.ab{padding:.38rem .6rem;font-size:.68rem}}
      `}</style>
    </div>
  );
}
