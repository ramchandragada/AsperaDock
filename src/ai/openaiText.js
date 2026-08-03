/**
 * Normalize OpenAI-compatible chat message content (string or part array).
 */
export function extractOpenAiCompatibleText(data) {
  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};
  const raw = message.content;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw)) {
    const joined = raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        if (part && typeof part.content === 'string') return part.content;
        return '';
      })
      .join('')
      .trim();
    if (joined) return joined;
  }
  // Some reasoning models put the visible answer in a secondary field.
  for (const key of ['output_text', 'refusal']) {
    const alt = message[key];
    if (typeof alt === 'string' && alt.trim()) return alt.trim();
  }
  return '';
}
