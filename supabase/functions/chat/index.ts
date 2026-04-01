import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langInstruction = language === "hi" 
      ? "CRITICAL LANGUAGE RULE: The user has selected Hindi (हिन्दी). You MUST respond ENTIRELY in Hindi using Devanagari script. Every single word of your response must be in Hindi. Do NOT use any English words except technical terms that have no Hindi equivalent. This is non-negotiable."
      : language === "kn"
      ? "CRITICAL LANGUAGE RULE: The user has selected Kannada (ಕನ್ನಡ). You MUST respond ENTIRELY in Kannada using Kannada script. Every single word of your response must be in Kannada. Do NOT use any English words except technical terms that have no Kannada equivalent. This is non-negotiable."
      : "Respond in English.";

    // Strip base64 images from history (keep only the last message's images) to prevent payload bloat
    const processedMessages = messages.map((msg: any, idx: number) => {
      if (idx < messages.length - 1 && Array.isArray(msg.content)) {
        // For older messages, strip image data but keep text
        const textParts = msg.content.filter((p: any) => p.type === "text");
        const hasImages = msg.content.some((p: any) => p.type === "image_url");
        if (hasImages) {
          textParts.push({ type: "text", text: "[User previously shared an image here]" });
        }
        return { ...msg, content: textParts.length === 1 ? textParts[0].text : textParts };
      }
      return msg;
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `You are AI Studio, a friendly and helpful AI assistant. ${langInstruction}

IMPORTANT RULES FOR YOUR RESPONSES:
1. Use SIMPLE, everyday language. Explain things like you're talking to a friend.
2. Avoid technical jargon. If you must use a technical term, explain it in simple words.
3. Keep answers SHORT and to the point. Don't over-explain.
4. Use examples from daily life to explain complex topics.
5. Use emojis occasionally to make responses feel friendly 😊
6. Break long answers into small, easy-to-read bullet points.
7. If someone asks a simple question, give a simple answer — don't write an essay.

YOUR CAPABILITIES:
🧠 You can answer questions on any topic — science, math, history, health, cooking, etc.
💾 You remember the full conversation, so you can refer back to what was discussed.
👁️ If someone sends a photo, describe what you see in simple words.
🌐 You can chat in multiple languages.

FORMAT: Use short paragraphs, bullet points, and bold for key words. Keep it clean and easy to read.`
          },
          ...processedMessages,
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (e) {
    console.error("chat error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return new Response(JSON.stringify({ error: isTimeout ? "Request timed out. Try a smaller image or simpler question." : msg }), {
      status: isTimeout ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
