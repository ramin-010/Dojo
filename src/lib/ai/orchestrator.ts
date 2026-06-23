import { generateWithGroq } from './providers/groq';
import { generateWithGoogle } from './providers/google';
import { generateWithCohere } from './providers/cohere';

export interface AIGenerationResult {
  raw: string;
  provider: string;
}

/**
 * Generic AI content generation with cascading provider fallback.
 * Groq (primary) → Google (secondary) → Cohere (tertiary)
 *
 * @param prompt - The user's prompt
 * @param systemPrompt - The system prompt defining output format
 */
export async function generateAIContent(
  prompt: string,
  systemPrompt: string
): Promise<AIGenerationResult> {
  // 1. Groq - Llama 3.3 70B (Smartest, fast)
  try {
    const raw = await generateWithGroq(prompt, systemPrompt, 'llama-3.3-70b-versatile', 8192);
    return { raw, provider: 'groq (llama-3.3-70b)' };
  } catch (err: any) {
    console.warn(`⚠️ Groq (Llama 70B) failed: ${err.message || err}`);
    console.log('⤵️ Falling back to Google Gemini...');
  }

  // 2. Google - Gemini 2.5 Flash
  try {
    const raw = await generateWithGoogle(prompt, systemPrompt, 'gemini-2.5-flash');
    return { raw, provider: 'google (gemini)' };
  } catch (err: any) {
    console.warn(`⚠️ Google AI (Gemini) failed: ${err.message || err}`);
    console.log('⤵️ Falling back to Groq Llama 3.1 8B...');
  }

  // 3. Groq - Llama 3.1 8B (Safety net)
  try {
    const raw = await generateWithGroq(prompt, systemPrompt, 'llama-3.1-8b-instant', 8192);
    return { raw, provider: 'groq (llama-3.1-8b)' };
  } catch (err: any) {
    console.warn(`⚠️ Groq (Llama 3.1 8B) failed: ${err.message || err}`);
    console.log('⤵️ Falling back to Cohere...');
  }

  // 4. Cohere - Command R (Final safety net)
  try {
    const raw = await generateWithCohere(prompt, systemPrompt, 'command-r');
    return { raw, provider: 'cohere' };
  } catch (err: any) {
    console.error(`❌ Cohere failed: ${err.message || err}`);
  }

  throw new Error('All AI providers failed. Please try again later.');
}
