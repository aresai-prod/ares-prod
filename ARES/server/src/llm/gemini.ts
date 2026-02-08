import { GoogleGenAI } from "@google/genai";

export async function runGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: prompt
  });

  const anyResponse = response as unknown as { text?: string };
  if (anyResponse.text) return anyResponse.text;
  return "";
}
