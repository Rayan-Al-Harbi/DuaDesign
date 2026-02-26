"use client";
import { useState, useCallback, useEffect } from "react";
import WishInput from "@/components/WishInput";
import DuaDisplay from "@/components/DuaDisplay";
import type { GeneratedDua, ApiResponse } from "@/types/dua";

type State = "idle" | "loading" | "success" | "error";
interface HistEntry { id: string; wishes: string[]; dua: GeneratedDua; date: string; }

function loadHist(): HistEntry[] { try { return JSON.parse(localStorage.getItem("dua-h") || "[]"); } catch { return []; } }
function saveHist(h: HistEntry[]) { try { localStorage.setItem("dua-h", JSON.stringify(h.slice(0, 12))); } catch {} }
function track(event: string) { fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) }).catch(() => {}); }

export default function Home() {
  const [wishes, setWishes] = useState<string[]>([""]);
  const [state, setState] = useState<State>("idle");
  const [dua, setDua] = useState<GeneratedDua | null>(null);
  const [error, setError] = useState("");
  const [hist, setHist] = useState<HistEntry[]>([]);
  const [showHist, setShowHist] = useState(false);
  const [lastW, setLastW] = useState<string[]>([]);
  const [regen, setRegen] = useState(false);

  useEffect(() => { setHist(loadHist()); track("pageview"); }, []);

  const addToHist = useCallback((w: string[], d: GeneratedDua) => {
    const entry: HistEntry = { id: Date.now().toString(), wishes: w, dua: d, date: new Date().toLocaleDateString("ar-SA") };
    const updated = [entry, ...hist].slice(0, 12);
    setHist(updated); saveHist(updated);
  }, [hist]);

  const gen = useCallback(async (wl: string[]) => {
    const f = wl.filter(w => w.trim().length > 0);
    if (!f.length) { setError("يرجى إدخال رغبة واحدة على الأقل"); setState("error"); return; }
    setState("loading"); setError("");

    try {
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wishes: f }) });
      const d: ApiResponse = await r.json();
      if (!d.success || !d.data) { setError(d.error || "حدث خطأ غير متوقع"); setState("error"); return; }
      setDua(d.data); setLastW(f); setState("success");
      addToHist(f, d.data); track("generate");
    } catch { setError("فشل الاتصال بالخادم. يرجى المحاولة لاحقاً."); setState("error"); }
  }, [addToHist]);

  const handleGen = useCallback(() => gen(wishes), [wishes, gen]);

  const handleRegen = useCallback(async () => {
    if (!lastW.length) return; setRegen(true);
    try {
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wishes: lastW }) });
      const d: ApiResponse = await r.json();
      if (d.success && d.data) { setDua(d.data); addToHist(lastW, d.data); track("generate"); }
    } catch {} setRegen(false);
  }, [lastW, addToHist]);

  const reset = useCallback(() => { setWishes([""]); setDua(null); setState("idle"); setError(""); }, []);

  // Edit wishes: go back to input with current wishes pre-filled
  const editWishes = useCallback(() => {
    setWishes(lastW.length > 0 ? [...lastW] : [""]);
    setDua(null);
    setState("idle");
    setError("");
  }, [lastW]);

  return (
    <main className="pg">
      <div className="ln ll">🏮</div>
      <div className="ln lr">🏮</div>
      <div className="ct">
        <header className="hd">
          <div className="cm">☽</div>
          <div className="ol"><span className="os">✦</span><span className="oc">﴿وَقَالَ رَبُّكُمُ ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ ۚ﴾</span><span className="os">✦</span></div>
          <h1 className="tt">اكتب ما في قلبك</h1>
          <p className="st">حوّل رغباتك إلى دعاء مستلهم من الأدعية المأثورة</p>
        </header>

        {hist.length > 0 && state !== "loading" && (
          <button className="ht" onClick={() => setShowHist(!showHist)}>
            <span className="hi">☰</span> {showHist ? "إخفاء السجل" : `أدعيتي السابقة (${hist.length})`}
          </button>
        )}
        {showHist && hist.length > 0 && (
          <div className="hp">
            {hist.map(e => (
              <button key={e.id} className="he" onClick={() => { setDua(e.dua); setLastW(e.wishes); setState("success"); setShowHist(false); }}>
                <div className="hw">{e.wishes.join(" • ")}</div>
                <div className="hd2">{e.date}</div>
              </button>
            ))}
            <button className="hc" onClick={() => { setHist([]); saveHist([]); }}>مسح السجل</button>
          </div>
        )}

        {state !== "success" && (
          <section className="is">
            <WishInput wishes={wishes} onChange={setWishes} disabled={state === "loading"} />
            {error && <div className="em" role="alert">{error}</div>}
            <button onClick={handleGen} disabled={state === "loading"} className="gb">
              {state === "loading" ? <span className="lc"><span className="sp"/>جاري إنشاء الدعاء...</span> : <span className="bc">إنشاء الدعاء</span>}
            </button>
          </section>
        )}

        {state === "success" && dua && (
          <section className="rs">
            <DuaDisplay dua={dua} onRegenerate={handleRegen} isRegenerating={regen} />
            <div className="result-actions">
              <button onClick={editWishes} className="ra-btn">✎ تعديل الرغبات</button>
              <button onClick={reset} className="ra-btn">✦ دعاء جديد</button>
            </div>
          </section>
        )}

        <footer className="ft">
          <div className="fo">✦ ✦ ✦</div>
          <p className="ft-note">منشأ بالذكاء الأصطناعي — يُرجى المراجعة قبل الاستخدام</p>
          <div className="ft-links">
            <a href="/faq" className="ft-link">الأسئلة الشائعة</a>
          </div>
          <p className="ft-credit">صنع بواسطة <a href="https://www.linkedin.com/in/rayan-alharbi-b8227030b/" target="_blank" rel="noopener noreferrer" className="ft-name">ريان الحربي</a></p>
        </footer>
      </div>

      <style jsx>{`
        .pg{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:2.5rem 1rem 4rem;position:relative;z-index:1}
        .ct{width:100%;max-width:580px;display:flex;flex-direction:column;gap:2rem}
        .ln{position:fixed;top:.8rem;font-size:2.5rem;opacity:.25;z-index:0;pointer-events:none;filter:drop-shadow(0 0 10px rgba(212,168,75,.3));animation:sw 4s ease-in-out infinite}
        .ll{left:4%}.lr{right:4%;animation-delay:2s}
        @keyframes sw{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        .hd{text-align:center;padding-top:.3rem}
        .cm{font-size:2.5rem;color:var(--gold);opacity:.45;filter:drop-shadow(0 0 15px rgba(212,168,75,.2));margin-bottom:.4rem}
        .ol{display:flex;align-items:center;justify-content:center;gap:.75rem;margin-bottom:1.2rem}
        .os{color:rgba(212,168,75,.18);font-size:.5rem}
        .oc{color:var(--gold-d);font-size:.85rem;font-family:"Amiri",serif}
        .tt{font-family:"Amiri",serif;font-size:2.5rem;font-weight:700;color:var(--txt);line-height:1.3;margin-bottom:.6rem;text-shadow:0 0 30px rgba(212,168,75,.06)}
        .st{font-size:.88rem;color:var(--txt2);font-weight:300;line-height:1.7}
        .ht{display:flex;align-items:center;justify-content:center;gap:.5rem;background:0 0;border:1px solid var(--bdr);border-radius:12px;color:var(--txt2);padding:.55rem 1rem;font-size:.78rem;font-family:"IBM Plex Sans Arabic",sans-serif;cursor:pointer;transition:all .25s ease;direction:rtl}
        .ht:hover{border-color:var(--bdr-g);color:var(--gold-d)}.hi{font-size:.85rem}
        .hp{display:flex;flex-direction:column;gap:.35rem;background:rgba(13,18,42,.5);border:1px solid var(--bdr);border-radius:16px;padding:.7rem;max-height:200px;overflow-y:auto;animation:fi .3s ease}
        .he{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;padding:.55rem .8rem;cursor:pointer;transition:all .2s ease;text-align:right;direction:rtl;font-family:"IBM Plex Sans Arabic",sans-serif}
        .he:hover{background:var(--gold-s);border-color:var(--bdr-g)}
        .hw{font-size:.78rem;color:var(--txt2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hd2{font-size:.68rem;color:var(--txt3);flex-shrink:0;margin-right:.7rem}
        .hc{align-self:center;background:0 0;border:none;color:var(--txt3);font-size:.68rem;cursor:pointer;font-family:"IBM Plex Sans Arabic",sans-serif;padding:.35rem;margin-top:.2rem}.hc:hover{color:var(--err)}
        .is{display:flex;flex-direction:column;gap:1.2rem}
        .em{background:rgba(229,115,115,.06);border:1px solid rgba(229,115,115,.15);border-radius:12px;padding:.7rem 1rem;color:var(--err);font-size:.83rem;text-align:center;direction:rtl}
        .gb{width:100%;padding:1.1rem;background:linear-gradient(135deg,rgba(212,168,75,.12),rgba(212,168,75,.05));border:1px solid rgba(212,168,75,.25);border-radius:16px;color:var(--gold);font-size:1.05rem;font-weight:500;font-family:"IBM Plex Sans Arabic",sans-serif;cursor:pointer;transition:all .35s ease;position:relative;overflow:hidden}
        .gb::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(212,168,75,.08),transparent);opacity:0;transition:opacity .35s}
        .gb:hover::before{opacity:1}
        .gb:hover{border-color:var(--gold-d);box-shadow:0 4px 30px rgba(212,168,75,.12),0 0 60px rgba(212,168,75,.04);transform:translateY(-2px)}
        .gb:active{transform:translateY(0)}
        .gb:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .bc{display:flex;align-items:center;justify-content:center;gap:.6rem}
        .bb{font-size:1.3rem;opacity:.55}
        .lc{display:flex;align-items:center;justify-content:center;gap:.6rem}
        .sp{width:18px;height:18px;border:2px solid rgba(212,168,75,.2);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .rs{display:flex;flex-direction:column;gap:1.2rem;animation:fi .5s ease-out}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        .result-actions{display:flex;justify-content:center;gap:.6rem;flex-wrap:wrap}
        .ra-btn{background:0 0;border:1px solid var(--bdr);border-radius:12px;color:var(--txt2);padding:.55rem 1.2rem;font-size:.8rem;font-family:"IBM Plex Sans Arabic",sans-serif;cursor:pointer;transition:all .25s ease;direction:rtl}
        .ra-btn:hover{color:var(--gold-d);border-color:var(--bdr-g);box-shadow:0 0 15px rgba(212,168,75,.06)}

        .ft{text-align:center;padding-top:2rem}
        .fo{color:rgba(212,168,75,.12);font-size:.45rem;letter-spacing:.8em;margin-bottom:.8rem}
        .ft-note{font-size:.68rem;color:var(--txt3);line-height:1.7;margin-bottom:.8rem}
        .ft-links{display:flex;justify-content:center;gap:1rem;margin-bottom:.8rem}
        .ft-link{color:var(--gold-d);text-decoration:none;font-size:.75rem;font-family:"IBM Plex Sans Arabic",sans-serif;transition:color .2s;border-bottom:1px solid rgba(212,168,75,.15);padding-bottom:1px}
        .ft-link:hover{color:var(--gold)}
        .ft-credit{font-size:.7rem;color:var(--txt3);margin-bottom:.3rem}
        .ft-name{color:var(--txt3);text-decoration:none;transition:color .2s ease}
        .ft-name:hover{color:var(--gold-d)}
        .ft-brand{font-family:"Amiri",serif;font-size:.95rem;color:rgba(212,168,75,.12);margin-top:.3rem}

        @media(max-width:640px){.pg{padding:1.5rem .75rem 3rem}.tt{font-size:2rem}.ct{gap:1.5rem}.ln{font-size:1.8rem;top:.4rem}.cm{font-size:2rem}}
      `}</style>
    </main>
  );
}
