import { NextRequest, NextResponse } from "next/server";
import { preprocessWishes } from "@/services/preprocessingService";
import { generateDua } from "@/services/llmService";
import { validateDua } from "@/services/validationService";
import { isRateLimited } from "@/lib/rateLimiter";
import type { ApiResponse, GeneratedDua } from "@/types/dua";

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const t0 = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, error: "تم تجاوز الحد المسموح. يرجى المحاولة بعد قليل." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const pre = preprocessWishes(body.wishes);
    if (!pre.success || !pre.data) {
      return NextResponse.json({ success: false, error: pre.error }, { status: 400 });
    }

    let dua: GeneratedDua;
    try { dua = await generateDua(pre.data); }
    catch (e) {
      console.error("[Pipeline] Gen failed:", e);
      return NextResponse.json({ success: false, error: "حدث خطأ أثناء إنشاء الدعاء. يرجى المحاولة لاحقاً." }, { status: 500 });
    }

    let v = validateDua(dua);
    if (!v.isValid) {
      try { dua = await generateDua(pre.data); v = validateDua(dua); } catch { /* */ }
      if (!v.isValid) {
        return NextResponse.json({ success: false, error: "لم نتمكن من إنشاء دعاء مطابق للمعايير." }, { status: 500 });
      }
    }

    console.log(`✅ wishes=${pre.data.wishCount} cats=[${dua.matchedCategories}] ${Date.now() - t0}ms`);
    return NextResponse.json({ success: true, data: dua });
  } catch (e) {
    console.error("[Pipeline]", e);
    return NextResponse.json({ success: false, error: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
