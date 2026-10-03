/**
 * Content generation
 * Generate tidbits and interview questions using Gemini.
 */

import { queryGemini } from './ollama.js';

function parseList(text, limit) {
  const items = text
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  return items.slice(0, limit);
}

export async function generateTidbits(articles, userProfile) {
  const interests = (userProfile.interests || []).join(', ');
  const level = userProfile.level || 'intermediate';

  const prompt = `You are a tech educator. Based on these fresh articles about ${interests}, generate 3-5 key technical insights for a ${level}-level developer.

Articles:
${articles.map((a, i) => `${i + 1}. "${a.title}": ${(a.content || a.snippet || '').slice(0, 3500)}`).join('\n')}

Return ONLY 3-5 concise numbered insights. No intro or explanation.`;

  try {
    const response = await queryGemini(prompt);
    const items = parseList(response, 5);
    return items.length ? items : ['Unable to generate tidbits at this time'];
  } catch (error) {
    console.error('Error generating tidbits:', error.message);
    return ['Unable to generate tidbits at this time'];
  }
}

export async function generateQuestions(userProfile, tidbits) {
  const interests = (userProfile.interests || []).join(', ');
  const level = userProfile.level || 'intermediate';

  const prompt = `You are an interviewer preparing technical questions for a ${level}-level developer interested in ${interests}.

Based on these fresh technical topics: ${tidbits.join('; ')}

Generate exactly 5 practical interview questions. Include conceptual, coding/algorithmic, system-design, and behavioural coverage.

Return ONLY the 5 numbered questions. No intro, explanation, or answers.`;

  try {
    const response = await queryGemini(prompt);
    const items = parseList(response, 5);
    return items.length === 5 ? items : [
      ...items,
      ...Array.from({ length: 5 - items.length }, (_, i) => 'Explain a practical trade-off in ' + (userProfile.interests?.[i % Math.max(userProfile.interests?.length || 1, 1)] || 'software engineering') + '.')
    ].slice(0, 5);
  } catch (error) {
    console.error('Error generating questions:', error.message);
    return ['Unable to generate questions at this time'];
  }
}
