import type { LLMConfig, ValidatedInput, GeneratedDua } from "@/types/dua";
import { matchTopics, type MatchedContext } from "@/services/topicMatcherService";
import type { DuaReference } from "@/data/duaKnowledgeBase";
import { normalizeArabic, splitSegments } from "@/lib/arabicText";

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

function buildSystemPrompt(references: DuaReference[]): string {
  const refBlock = references
    .map((r) => `- "${r.text}"${r.source ? ` (${r.source})` : ""}`)
    .join("\n");

  return `أنت عالم إسلامي بليغ متخصص في صياغة الأدعية باللغة العربية الفصحى، تتميز بالبلاغة والبيان وحسن الصياغة.

# مهمتك
اكتب دعاءً واحداً متصلاً وبليغاً يتضمن جميع رغبات المستخدم. الدعاء يجب أن يكون كالنهر — يتدفق بسلاسة من فقرة إلى أخرى بأسلوب عربي فصيح راقٍ.

# أدعية مرجعية للاستلهام
هذه أدعية مأثورة وعبارات أصيلة. استلهم منها روحها وأسلوبها البلاغي دون نسخها حرفياً:

${refBlock}

# قواعد الصياغة
- اكتب بالعربية الفصحى فقط. لا كلمة واحدة بالإنجليزية.
- اكتب دعاءً واحداً متصلاً بدون JSON أو عناوين أو تنسيق أو ترقيم.
- مهم جداً: الرغبات هي أمنيات وطلبات يريد المستخدم تحقيقها في المستقبل وليست أحداثاً تحصل الآن. مثلاً إذا كتب "السفر إلى مكة" فهو يطلب من الله أن يرزقه السفر إلى مكة، وليس أنه مسافر حالياً. استخدم صيغة الطلب والرجاء: "اللهم ارزقني"، "اللهم اكتب لي"، "اللهم يسّر لي".
- ابدأ بحمد الله والثناء عليه بعبارات متنوعة وجميلة.
- لكل رغبة من رغبات المستخدم، اكتب عدة جمل وعبارات دعائية مفصّلة ومتنوعة. لا تكتفِ بجملة واحدة لكل رغبة، بل توسع واستخدم أساليب بلاغية مختلفة مثل النداء والتضرع والرجاء والتوسل بأسماء الله الحسنى.
- استخدم أسماء الله الحسنى المناسبة لكل رغبة (مثلاً: يا رزاق للرزق، يا شافي للشفاء، يا فتاح للفرج).
- نوّع في الصيغ: استخدم "اللهم"، "يا رب"، "أسألك"، "نسألك"، "ارزقنا"، "اكتب لنا"، وغيرها.
- استخدم السجع الخفيف غير المتكلف حيث يحسن.
- اختم بالصلاة على النبي ﷺ والتوكل على الله بعبارات مؤثرة.
- لا تختلق آيات قرآنية ولا أحاديث نبوية.
- لا تكرر نفس العبارة أو نفس التركيب أكثر من مرة.
- الطول المطلوب: فقرة إلى فقرتين.

# المخرج
اكتب نص الدعاء فقط. لا شيء قبله ولا بعده.`;
}

function buildUserMessage(wishes: string[]): string {
  return `هذه أمنياتي التي أريد أن أدعو الله بها (كلها أمور أتمنى تحقيقها وليست أحداثاً حالية):\n${wishes.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;
}

async function callLLM(systemPrompt: string, userMessage: string, config: LLMConfig): Promise<string> {
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
        options: { temperature: 0.85, num_predict: 1024, repeat_penalty: 1.15 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = await res.json();
    return (data.message?.content || "").trim();
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
      temperature: 0.85, max_tokens: 1024,
      frequency_penalty: 0.4, presence_penalty: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[LLM] Error:", res.status, body);
    throw new Error(`LLM returned ${res.status}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
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
  const systemPrompt = buildSystemPrompt(context.references);
  const userMessage = buildUserMessage(input.wishes);

  console.log(`[LLM] model=${config.model} refs=${context.references.length} cats=[${context.matchedCategories}]`);

  const raw = await callLLM(systemPrompt, userMessage, config);
  const { text, removed } = cleanResponse(raw);
  if (removed > 0) console.warn(`[LLM] stripped ${removed} duplicated segment(s) from ${config.model}`);

  if (text.length < 20) throw new Error("LLM returned insufficient content");

  return { text, matchedCategories: context.matchedCategories, referencesUsed: context.references.length };
}
