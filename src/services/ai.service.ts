import OpenAI from 'openai';

let _client: OpenAI | null = null;
const getClient = () => {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
};
const MODEL = () => process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export const aiService = {
  async generateChapterSummary(book: string, chapter: number, verseText: string): Promise<string> {
    const response = await getClient().chat.completions.create({
      model: MODEL(),
      messages: [
        {
          role: 'system',
          content:
            'You are a knowledgeable and concise Bible study assistant. When given a Bible chapter, provide a clear 3-5 sentence summary covering: the main events or teachings, key themes, and spiritual significance. Write in a warm, accessible tone suitable for all levels of Bible knowledge. Do not add headers or bullet points — plain paragraph only.',
        },
        {
          role: 'user',
          content: `Summarize ${book} chapter ${chapter}:\n\n${verseText.slice(0, 6000)}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.4,
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  },

  async generateReflectionPrompts(book: string, chapter: number, verse: string, verseText: string): Promise<string[]> {
    const response = await getClient().chat.completions.create({
      model: MODEL(),
      messages: [
        {
          role: 'system',
          content:
            'You are a thoughtful Christian spiritual director. Given a Bible verse, generate exactly 3 deep, personal reflection questions that help the reader apply the scripture to their daily life. Each question should be on its own line, numbered 1. 2. 3. No introduction or closing text.',
        },
        {
          role: 'user',
          content: `${book} ${chapter}:${verse} — "${verseText}"`,
        },
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return text
      .split('\n')
      .map((l) => l.replace(/^\d+\.\s*/, '').trim())
      .filter((l) => l.length > 0)
      .slice(0, 3);
  },

  async generateExplanationPrompts(
    book: string,
    chapter: number,
    verse: string,
    verseText: string,
  ): Promise<string[]> {
    const response = await getClient().chat.completions.create({
      model: MODEL(),
      messages: [
        {
          role: 'system',
          content:
            'You are a knowledgeable Bible study assistant. Given a Bible verse, generate exactly 3 focused prompts that help explain the verse — such as historical context, theological meaning, or related passages. Each prompt should be on its own line, numbered 1. 2. 3. No introduction or closing text.',
        },
        {
          role: 'user',
          content: `${book} ${chapter}:${verse} — "${verseText}"`,
        },
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    return text
      .split('\n')
      .map((l) => l.replace(/^\d+\.\s*/, '').trim())
      .filter((l) => l.length > 0)
      .slice(0, 3);
  },

  async generateVerseExplanation(
    book: string,
    chapter: number,
    verse: string,
    verseText: string,
    translation: string,
    focusPrompt?: string,
  ): Promise<{ explanation: string; crossReferences: string }> {
    const focusLine = focusPrompt
      ? `\nFocus your explanation on: ${focusPrompt}`
      : '';

    const response = await getClient().chat.completions.create({
      model: MODEL(),
      messages: [
        {
          role: 'system',
          content:
            'You are a knowledgeable and accessible Bible commentary assistant. Given a Bible verse, provide a clear explanation and relevant cross-references. Respond ONLY with a JSON object in this exact shape: {"explanation":"2-4 sentence paragraph explaining the verse in plain language","crossReferences":"One sentence listing related passages with book/chapter/verse references"}. No markdown, no extra text.',
        },
        {
          role: 'user',
          content: `${book} ${chapter}:${verse} (${translation}) — "${verseText}"${focusLine}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '{}';
    try {
      const parsed = JSON.parse(text);
      return {
        explanation: parsed.explanation?.trim() ?? '',
        crossReferences: parsed.crossReferences?.trim() ?? '',
      };
    } catch {
      return { explanation: text, crossReferences: '' };
    }
  },

  async generateReadingRecommendations(params: {
    growthAreas: string[];
    recentBooks: string[];
    currentStreak: number;
  }): Promise<Array<{ book: string; chapter: number; reason: string }>> {
    const response = await getClient().chat.completions.create({
      model: MODEL(),
      messages: [
        {
          role: 'system',
          content:
            'You are a Bible study guide. Given a user\'s spiritual growth areas and recent reading, recommend exactly 3 Bible chapters to read next. Respond ONLY with a JSON object in this exact shape: {"recommendations":[{"book":"Genesis","chapter":1,"reason":"Short reason why"}]}. No markdown, no extra text.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            growthAreas: params.growthAreas,
            recentBooks: params.recentBooks,
            currentStreak: params.currentStreak,
          }),
        },
      ],
      max_tokens: 400,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '{"recommendations":[]}';
    try {
      const parsed = JSON.parse(text);
      // Handle both {recommendations:[...]} and direct array
      const arr = Array.isArray(parsed) ? parsed : (parsed.recommendations ?? parsed.chapters ?? []);
      return arr.slice(0, 3);
    } catch {
      return [];
    }
  },
};
