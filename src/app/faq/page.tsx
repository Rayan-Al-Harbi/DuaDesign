import type { Metadata } from "next";

export const metadata: Metadata = { title: "الأسئلة الشائعة | دعاء" };

const faqs = [
  { q: "ما هو DuaDesign", a: "تطبيق دعاء يحوّل رغباتك وأمنياتك إلى دعاء عربي مستلهم من الأدعية المأثورة في السنة النبوية والقرآن الكريم، باستخدام تقنيات الذكاء الاصطناعي." },
  { q: "هل الأدعية المُنشأة صحيحة شرعياً؟", a: "الأدعية مستلهمة من مصادر إسلامية موثوقة مثل حصن المسلم وصحيح البخاري ومسلم، لكنها مُنشأة بالذكاء الاصطناعي. يُنصح بمراجعتها قبل الاستخدام." },
  { q: "ما هي خاصية الاستماع؟", a: "يمكنك الاستماع للدعاء بصوت عربي طبيعي. يستخدم الموقع نظاماً ذكياً يبدأ بأعلى جودة صوتية متاحة، وإذا لم تتوفر الخاصية بأعلى جودة ينتقل الصوت تلقائياً لمحرك بديل، يصبح الأستماع متاح دائماً."},
  { q: "هل يتم حفظ أدعيتي؟", a: "نعم، يتم حفظ آخر ١٢ دعاء في متصفحك فقط. لا نرسل أو نخزن البيانات في اي مكان — بياناتك تبقى في جهازك." },
  { q: "كيف يعمل النظام تقنياً؟", a: "يستخدم التطبيق تقنية RAG (Retrieval-Augmented Generation) حيث يطابق رغباتك مع ١٤ فئة من الأدعية المأثورة، ثم يستخدم المراجع ذات الصلة في سياق نموذج الذكاء الاصطناعي لإنتاج دعاء طبيعي ومتصل." },
  { q: "هل يمكنني تنزيل الدعاء كصورة؟", a: "نعم! اضغط على زر 🖼 صورة لتنزيل بطاقة دعاء يمكنك مشاركتها مع الاخرين." },
];

export default function FAQPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "2.5rem 1rem 4rem", position: "relative", zIndex: 1 }}>
      <div style={{ width: "100%", maxWidth: "620px" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <a href="/" style={{ color: "var(--gold-d)", textDecoration: "none", fontSize: ".85rem", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>→ العودة للرئيسية</a>
          <h1 style={{ fontFamily: "'Amiri', serif", fontSize: "2.2rem", color: "var(--txt)", marginTop: "1rem", marginBottom: ".5rem" }}>الأسئلة الشائعة</h1>
          <div style={{ color: "rgba(212,168,75,.2)", fontSize: ".5rem", letterSpacing: ".8em" }}>✦ ✦ ✦</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {faqs.map((f, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(212,168,75,.1)",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              direction: "rtl",
            }}>
              <h3 style={{
                fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                fontSize: ".95rem",
                fontWeight: 600,
                color: "var(--gold)",
                marginBottom: ".6rem",
                lineHeight: 1.6,
              }}>{f.q}</h3>
              <p style={{
                fontFamily: "'IBM Plex Sans Arabic', sans-serif",
                fontSize: ".85rem",
                color: "var(--txt2)",
                lineHeight: 1.9,
                fontWeight: 300,
              }}>{f.a}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <div style={{ color: "rgba(212,168,75,.12)", fontSize: ".45rem", letterSpacing: ".8em", marginBottom: ".7rem" }}>✦ ✦ ✦</div>
          <p style={{ fontSize: ".7rem", color: "var(--txt3)" }}>صنع بواسطة ريان الحربي</p>
        </div>
      </div>
    </main>
  );
}
