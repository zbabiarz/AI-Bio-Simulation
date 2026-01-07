import { supabase } from './supabase';

interface AIGenerationOptions {
  prompt: string;
  maxTokens?: number;
}

interface AIGenerationResult {
  content: string;
  tokensUsed: number;
}

export async function generateAIContent(options: AIGenerationOptions): Promise<AIGenerationResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-content`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        prompt: options.prompt,
        maxTokens: options.maxTokens || 2000,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate AI content');
  }

  const data = await response.json();
  return {
    content: data.content,
    tokensUsed: data.tokensUsed,
  };
}
