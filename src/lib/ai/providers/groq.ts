import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;

export async function generateWithGroq(
  prompt: string,
  systemPrompt: string,
  model: string = 'llama-3.3-70b-versatile',
  maxTokens: number = 8192
): Promise<string> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not defined.');
  }

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    model,
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content || '';
  if (!content) {
    throw new Error(`Groq returned empty response for model ${model}`);
  }

  return content;
}
