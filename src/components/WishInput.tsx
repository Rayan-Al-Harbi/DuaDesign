"use client";
import { useCallback } from "react";

interface Props { wishes: string[]; onChange: (w: string[]) => void; disabled: boolean; }
const MAX = 5, MAXL = 100;

export default function WishInput({ wishes, onChange, disabled }: Props) {
  const update = useCallback((i: number, v: string) => {
    if (v.length > MAXL) return;
    const u = [...wishes]; u[i] = v; onChange(u);
  }, [wishes, onChange]);
  const add = useCallback(() => { if (wishes.length < MAX) onChange([...wishes, ""]); }, [wishes, onChange]);
  const remove = useCallback((i: number) => { if (wishes.length > 1) onChange(wishes.filter((_, j) => j !== i)); }, [wishes, onChange]);

  return (
    <div className="wc">
      {wishes.map((w, i) => (
        <div key={i} className="wr">
          <div className="wf">
            <div className="wn">{i + 1}</div>
            <input type="text" value={w} onChange={e => update(i, e.target.value)}
              placeholder="اكتب رغبتك هنا..." disabled={disabled}
              className="wi" dir="rtl" lang="ar" maxLength={MAXL} />
            {wishes.length > 1 && <button type="button" onClick={() => remove(i)} disabled={disabled} className="rb" aria-label="حذف">✕</button>}
          </div>
        </div>
      ))}
      {wishes.length < MAX && (
        <button type="button" onClick={add} disabled={disabled} className="ab">
          <span className="ai">+</span> إضافة رغبة
        </button>
      )}
      <style jsx>{`
        .wc{display:flex;flex-direction:column;gap:.65rem}
        .wr{display:flex;flex-direction:column}
        .wf{display:flex;align-items:center;gap:.625rem;background:rgba(255,255,255,.03);border:1px solid var(--bdr-g);border-radius:14px;padding:.125rem .75rem .125rem .5rem;transition:all .3s ease;backdrop-filter:blur(8px)}
        .wf:focus-within{border-color:var(--gold-d);box-shadow:0 0 0 3px var(--gold-g),0 0 20px var(--gold-s)}
        .wn{min-width:1.75rem;height:1.75rem;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(212,168,75,.15),rgba(212,168,75,.08));color:var(--gold);border-radius:50%;font-size:.75rem;font-weight:600;flex-shrink:0;border:1px solid rgba(212,168,75,.15)}
        .wi{flex:1;background:0 0;border:none;outline:none;color:var(--txt);font-size:1rem;font-family:"IBM Plex Sans Arabic",sans-serif;padding:.875rem 0;line-height:1.6}
        .wi::placeholder{color:var(--txt3)}
        .wi:disabled{opacity:.5}
        .rb{background:0 0;border:none;color:var(--txt3);cursor:pointer;padding:.375rem;font-size:.875rem;border-radius:6px;transition:all .2s ease;flex-shrink:0}
        .rb:hover{color:var(--err);background:rgba(229,115,115,.1)}
        .rb:disabled{opacity:.3;cursor:not-allowed}
        .ab{display:flex;align-items:center;justify-content:center;gap:.5rem;background:0 0;border:1px dashed rgba(212,168,75,.2);border-radius:14px;color:var(--gold-d);padding:.7rem;font-size:.9rem;font-family:"IBM Plex Sans Arabic",sans-serif;cursor:pointer;transition:all .25s ease;direction:rtl}
        .ab:hover{background:var(--gold-s);border-color:var(--gold-d);color:var(--gold)}
        .ab:disabled{opacity:.3;cursor:not-allowed}
        .ai{font-size:1.1rem;font-weight:300}
      `}</style>
    </div>
  );
}
