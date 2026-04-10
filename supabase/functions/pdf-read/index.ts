import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64, fileName, question, language } = await req.json();
    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "No PDF data provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Decode base64 PDF and extract text using unpdf
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    let pdfText = "";
    try {
      const { text } = await extractText(bytes, { mergePages: true });
      pdfText = text.slice(0, 40000); // limit to stay within token budgets
    } catch (extractErr) {
      console.error("PDF text extraction failed:", extractErr);
      pdfText = "[Could not extract text from this PDF. It may be a scanned document or image-based PDF.]";
    }

    if (!pdfText || pdfText.trim().length < 20) {
      pdfText = "[The PDF appears to contain very little extractable text. It may be a scanned/image-based document.]";
    }

    const langInstruction = language === "hi"
      ? "Respond ENTIRELY in Hindi using Devanagari script."
      : language === "kn"
      ? "Respond ENTIRELY in Kannada using Kannada script."
      : "Respond in English.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a helpful PDF document analyzer. Analyze the extracted text from a PDF and answer questions about it clearly and simply. ${langInstruction} Use bullet points and simple language.`,
          },
          {
            role: "user",
            content: `Here is the extracted text from the PDF file "${fileName || "document.pdf"}":\n\n---\n${pdfText}\n---\n\n${question || "Please give me a clear summary of this document's contents."}`,
          },
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("pdf-read error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
