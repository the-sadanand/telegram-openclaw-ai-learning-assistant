/**
 * Content generation
 * Generate tidbits and interview questions using Gemini.
 */

import { queryGemini } from './gemini.js';

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
    if (items.length < 3) {
      throw new Error('Gemini returned fewer than 3 valid technical tidbits');
    }
    return items;
  } catch (error) {
    console.error('Error generating tidbits:', error.message);
    throw new Error('Failed to generate technical tidbits: ' + error.message);
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
    if (items.length !== 5) {
      throw new Error('Gemini returned ' + items.length + ' valid interview questions; expected exactly 5');
    }
    return items;
  } catch (error) {
    console.error('Error generating questions:', error.message);
    throw new Error('Failed to generate interview questions: ' + error.message);
  }
}
