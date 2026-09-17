import type { LLMConfig, ValidatedInput, GeneratedDua } from "@/types/dua";
import { matchTopics, type MatchedContext, type WishContext } from "@/services/topicMatcherService";
import { normalizeArabic, splitSegments } from "@/lib/arabicText";
import { scanScripture } from "@/services/scriptureGuard";

function getConfig(): LLMConfig {
  // Deployment dashboards can accidentally introduce surrounding whitespace.
  // Normalize values here so it cannot produce malformed request URLs.
  const apiKey = process.env.LLM_API_KEY?.trim();
  const baseUrl = process.env.LLM_BASE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.LLM_MODEL?.trim();
  if (!apiKey || !baseUrl || !model) {
    throw new Error("Missing LLM config. Set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL.");
  }
  return { apiKey, baseUrl, model };
}

/**
 * Build the reference block, grouped by the wish each set was retrieved for.
 *
 * Sources are deliberately omitted. They are not needed to compose a
 * supplication, and putting them in front of the model invites it to cite —
 * which is the behaviour that produced fabricated verses.
 */
function buildReferenceBlock(perWish: WishContext[]): string {
  return perWish
    .map((entry) => {
      const lines = entry.references.map((r) => `- ${r.text}`).join("\n");
      return `الرغبة: ${entry.wish}\n${lines}`;
    })
    .join("\n\n");
}

function buildSystemPrompt(perWish: WishContext[]): string {
  return `أنت عالم إسلامي بليغ متخصص في صياغة الأدعية باللغة العربية الفصحى.

# مهمتك
اصغ دعاءً واحداً متصلاً يجمع رغبات المستخدم كلها، بأسلوب عربي فصيح رصين.

# الأدعية المأثورة المتاحة لك
هذه نصوص ثابتة صحيحة، مرتبة تحت الرغبة التي تناسبها. ادعُ بها كما هي داخل دعائك، فهي دعاء يُقال لا نص يُقتبس. لك أن تُغيّر الضمير وحده (من "نا" إلى "ي" أو العكس) بما يوافق حال الداعي.

${buildReferenceBlock(perWish)}

# قواعد ملزمة
- لا تنسب أي كلام إلى الله ولا إلى النبي ﷺ. ممنوع منعاً باتاً: "قال تعالى"، "وقولك الحق"، "يا من قلت"، والأقواس ﴿ ﴾، وعلامات الاقتباس.
- ادعُ بالنصوص المأثورة أعلاه مباشرة ضمن سياق دعائك، دون تصدير ودون نسبة.
- لا تورد نصاً على أنه قرآن أو حديث. إن لم يناسبك نص مما سبق فادعُ بكلامك أنت.
- الرغبات أمنيات مستقبلية لا أحداث واقعة. من كتب "السفر إلى مكة" يسأل الله أن يرزقه ذلك. استعمل صيغة الطلب: "اللهم ارزقني"، "اللهم اكتب لي"، "اللهم يسّر لي".
- لكل رغبة جملتان إلى ثلاث، لا أكثر. عالج كل رغبة مرة واحدة ثم انتقل إلى التي تليها ولا تعد إليها.
- استخدم من أسماء الله الحسنى ما يناسب كل رغبة: يا رزاق للرزق، يا شافي للشفاء، يا فتاح للفرج.
- لا تكرر صيغة النداء نفسها أكثر من مرتين في الدعاء كله.
- لا تدعُ إلا بالرغبات المذكورة أعلاه وحدها. لا تضف موضوعاً لم يطلبه المستخدم مهما حسُن، ولا تسرد أبواب الدعاء سرداً.
- اكتب نصاً متصلاً بالعربية الفصحى وحدها: بلا عناوين ولا أرقام ولا نقاط ولا قوائم.

# البنية والطول
ابدأ بحمد الله والثناء عليه في جملة أو جملتين، ثم ادعُ لكل رغبة بجملتين أو ثلاث على ترتيب ورودها، ثم اختم بالصلاة على النبي ﷺ. الطول كله بين 120 و 180 كلمة في فقرة أو فقرتين. توقف فور انتهائك من الصلاة على النبي ﷺ ولا تكتب حرفاً بعدها.
الرغبة الواحدة لا تُطيل الدعاء: إن كانت رغبة واحدة فالدعاء أقصر، ولا تملأ الفراغ بمواضيع أخرى.

# نموذج للشكل والطول وحدهما — لا تنسخ ألفاظه ولا موضوعه
الحمد لله رب العالمين، حمداً طيباً مباركاً فيه، لا إله إلا هو الكريم الوهاب، له الأسماء الحسنى والصفات العلى. اللهم إني أسألك علماً نافعاً ورزقاً طيباً وعملاً متقبلاً، ويسّر لي أمري واشرح لي صدري، واكتب لي التوفيق فيما أقدمت عليه، وسدّد خطاي إلى ما تحب وترضى. اللهم لا سهل إلا ما جعلته سهلاً، فسهّل عليّ ما استصعب من أمري، وارزقني الثبات عند الشدائد وحسن الظن بك عند كل بلاء. يا فتاح، افتح لي أبواب رحمتك، ويا رزاق، ابسط لي من فضلك، واجعل لي من كل ضيق مخرجاً ومن كل همٍّ فرجاً. اللهم ما قسمته لي فبارك لي فيه، وما صرفته عني فاجعله خيرة لي في ديني ودنياي. وصلِّ اللهم وسلم على نبينا محمد وعلى آله وصحبه أجمعين.

# المخرج
نص الدعاء وحده. لا شيء قبله ولا بعده.`;
}

function buildUserMessage(wishes: string[]): string {
  return `هذه أمنياتي التي أريد أن أدعو الله بها (كلها أمور أتمنى تحقيقها وليست أحداثاً حالية):\n${wishes.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;
}

interface LLMReply {
  text: string;
  /** The model ran out of budget mid-sentence rather than finishing. */
  truncated: boolean;
}

// Sized to the 180-word target rather than generously above it. Headroom is
// not free with this model: given budget it fills it, padding a single-wish
// dua out to four hundred words. Overshoot is trimmed to the last whole
// sentence, so a tight ceiling costs a clause and buys a dua that ends.
const MAX_OUTPUT_TOKENS = 420;

async function callLLM(systemPrompt: string, userMessage: string, config: LLMConfig): Promise<LLMReply> {
  const isOllama = config.baseUrl.includes("localhost:11434") || config.baseUrl.includes("127.0.0.1:11434");

  if (isOllama) {
    const url = config.baseUrl.replace(/\/v1\/?$/, "");
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        think: false, stream: false,
        options: { temperature: 0.85, num_predict: MAX_OUTPUT_TOKENS, repeat_penalty: 1.15 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = await res.json();
    return { text: (data.message?.content || "").trim(), truncated: data.done_reason === "length" };
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      // ALLaM 2 7B is small enough to loop when it has budget left over: it
      // re-states a petition, or restarts the dua from the top. Keep the
      // temperature up and penalize repeats so it varies phrasing instead.
      temperature: 0.85, max_tokens: MAX_OUTPUT_TOKENS,
      // frequency_penalty discourages reusing the same phrasing. presence_penalty
      // is deliberately absent: it penalizes every token already seen, which
      // pushed the model off the user's wish onto fresh subject matter -- a
      // request for one wish came back as a numbered catalogue of thirteen.
      frequency_penalty: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[LLM] Error:", res.status, body);
    throw new Error(`LLM returned ${res.status}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  return { text: (choice?.message?.content || "").trim(), truncated: choice?.finish_reason === "length" };
}

/**
 * Cut a truncated response back to its last complete sentence.
 *
 * A response that hit the token ceiling ends mid-word. Serving that is worse
 * than serving a shorter dua, so drop the unfinished tail.
 */
function trimToLastSentence(text: string): string {
  const lastEnd = Math.max(text.lastIndexOf("."), text.lastIndexOf("؟"), text.lastIndexOf("!"));
  return lastEnd > 0 ? text.slice(0, lastEnd + 1).trim() : text;
}

// Short refrains ("يا رب") are legitimately repeated in a dua; only segments
// with real content are deduplicated.
const MIN_DEDUPE_LENGTH = 15;

/**
 * Drop segments the model already emitted. Covers both failure modes seen with
 * small models: a repeated petition, and the whole dua restarted from the top.
 */
function dedupeSegments(text: string): { text: string; removed: number } {
  const seen = new Set<string>();
  let removed = 0;

  const paragraphs = text.split(/\n\s*\n/).map((para) => {
    const kept = splitSegments(para).filter((seg) => {
      const key = normalizeArabic(seg);
      if (key.length < MIN_DEDUPE_LENGTH) return true;
      if (seen.has(key)) { removed++; return false; }
      seen.add(key);
      return true;
    });
    return kept.join(" ");
  });

  return { text: paragraphs.filter(Boolean).join("\n\n").trim(), removed };
}

function cleanResponse(raw: string): { text: string; removed: number } {
  let text = raw;
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```[\s\S]*?```/g, "").trim();
  text = text.replace(/\*\*/g, "");
  text = text.replace(/^#+\s.*/gm, "").trim();
  const lines = text.split("\n");
  const filtered = lines.filter((l) => { const t = l.trim(); return t.length === 0 || /[\u0600-\u06FF]/.test(t); });
  return dedupeSegments(filtered.join("\n").trim());
}

export async function generateDua(input: ValidatedInput): Promise<GeneratedDua> {
  const config = getConfig();
  const context: MatchedContext = matchTopics(input.wishes);
  const systemPrompt = buildSystemPrompt(context.perWish);
  const userMessage = buildUserMessage(input.wishes);

  console.log(`[LLM] model=${config.model} refs=${context.references.length} cats=[${context.matchedCategories}]`);

  const reply = await callLLM(systemPrompt, userMessage, config);

  // Order matters: cut the unfinished tail before deduplicating, so a partial
  // sentence is not compared against a whole one.
  let raw = reply.text;
  if (reply.truncated) {
    raw = trimToLastSentence(raw);
    console.warn(`[LLM] ${config.model} hit the token ceiling; trimmed to the last complete sentence`);
  }

  const scan = scanScripture(raw, context.references);
  if (scan.attributions > 0) {
    console.warn(`[LLM] removed ${scan.attributions} scripture attribution(s)`);
  }
  if (scan.unverified.length > 0) {
    console.warn(`[LLM] ${scan.unverified.length} quoted span(s) match no reference: ${JSON.stringify(scan.unverified.slice(0, 3))}`);
  }

  const { text, removed } = cleanResponse(scan.text);
  if (removed > 0) console.warn(`[LLM] stripped ${removed} duplicated segment(s) from ${config.model}`);

  if (text.length < 20) throw new Error("LLM returned insufficient content");

  return {
    text,
    matchedCategories: context.matchedCategories,
    referencesUsed: context.references.length,
    fabricatedQuotes: scan.unverified.length,
    truncated: reply.truncated,
  };
}
