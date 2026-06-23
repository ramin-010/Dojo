import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

export async function generateWithGoogle(
  prompt: string,
  systemPrompt: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    },
  });

  const content = response.text;
  if (!content) {
    throw new Error(`Google GenAI returned empty response for model ${model}`);
  }

  return content;
}
