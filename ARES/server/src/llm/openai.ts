import OpenAI from "openai";

export async function runOpenAi(prompt: string, apiKey: string, model: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: prompt
  });

  // SDK provides output_text; fall back to manual extraction.
  const anyResponse = response as unknown as { output_text?: string; output?: any[] };
  if (anyResponse.output_text) return anyResponse.output_text;

  const output = anyResponse.output ?? [];
  for (const item of output) {
    const content = item?.content ?? [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        return part.text;
      }
    }
  }

  return "";
}
