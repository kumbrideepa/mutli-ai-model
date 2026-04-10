import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const langInstruction = language === "hi"
      ? "Respond ENTIRELY in Hindi using Devanagari script."
      : language === "kn"
      ? "Respond ENTIRELY in Kannada using Kannada script."
      : "Respond in English.";

    const userQuestion = question || "Please give me a clear summary of this document's contents.";

    // Try text extraction first
    let pdfText = "";
    try {
      const { extractText } = await import("https://esm.sh/unpdf@0.12.1");
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const { text } = await extractText(bytes, { mergePages: true });
      pdfText = (text || "").trim().slice(0, 40000);
    } catch (e) {
      console.log("Text extraction failed, will use vision fallback:", e.message);
    }

    let messages;
    if (pdfText.length >= 50) {
      // Good text extraction - use text-based approach
      console.log(`Extracted ${pdfText.length} chars from PDF`);
      messages = [
        {
          role: "system",
          content: `You are a helpful PDF document analyzer. Analyze the document text and answer questions clearly. ${langInstruction} Use bullet points and simple language.`,
        },
        {
          role: "user",
          content: `Here is the text from "${fileName || "document.pdf"}":\n\n---\n${pdfText}\n---\n\n${userQuestion}`,
        },
      ];
    } else {
      // Poor/no text - send PDF as image for vision model
      console.log("Using vision fallback for scanned/image PDF");
      messages = [
        {
          role: "system",
          content: `You are a helpful PDF document analyzer. Read the document image and answer questions clearly. ${langInstruction} Use bullet points and simple language.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            {
              type: "text",
              text: `This is a PDF file named "${fileName || "document.pdf"}". ${userQuestion}`,
            },
          ],
        },
      ];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
