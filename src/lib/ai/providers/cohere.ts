import { CohereClient } from 'cohere-ai';

const apiKey = process.env.COHERE_API_KEY;

export async function generateWithCohere(
  prompt: string,
  systemPrompt: string,
  model: string = 'command-r'
): Promise<string> {
  if (!apiKey) {
    throw new Error('COHERE_API_KEY is not defined.');
  }

  const cohere = new CohereClient({
    token: apiKey,
  });

  const response = await cohere.chat({
    model,
    message: prompt,
    preamble: systemPrompt,
    temperature: 0.7,
  });

  const content = response.text;
  if (!content) {
    throw new Error(`Cohere returned empty response for model ${model}`);
  }

  return content;
}
