import type { LLMConfig, ValidatedInput, GeneratedDua } from "@/types/dua";
import { matchTopics, type MatchedContext } from "@/services/topicMatcherService";
import type { DuaReference } from "@/data/duaKnowledgeBase";

function getConfig(): LLMConfig {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
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
        options: { temperature: 0.8, num_predict: 1024 },
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
      temperature: 0.8, max_tokens: 1024,
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

function cleanResponse(raw: string): string {
  let text = raw;
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```[\s\S]*?```/g, "").trim();
  text = text.replace(/\*\*/g, "");
  text = text.replace(/^#+\s.*/gm, "").trim();
  const lines = text.split("\n");
  const filtered = lines.filter((l) => { const t = l.trim(); return t.length === 0 || /[\u0600-\u06FF]/.test(t); });
  return filtered.join("\n").trim();
}

export async function generateDua(input: ValidatedInput): Promise<GeneratedDua> {
  const config = getConfig();
  const context: MatchedContext = matchTopics(input.wishes);
  const systemPrompt = buildSystemPrompt(context.references);
  const userMessage = buildUserMessage(input.wishes);

  console.log(`[LLM] model=${config.model} refs=${context.references.length} cats=[${context.matchedCategories}]`);

  const raw = await callLLM(systemPrompt, userMessage, config);
  const text = cleanResponse(raw);

  if (text.length < 20) throw new Error("LLM returned insufficient content");

  return { text, matchedCategories: context.matchedCategories, referencesUsed: context.references.length };
}
