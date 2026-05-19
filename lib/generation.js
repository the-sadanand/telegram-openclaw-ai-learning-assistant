/**
 * Content generation
 * Generate tidbits and interview questions using Ollama
 */

import { queryOllama } from './ollama.js';

export async function generateTidbits(articles, userProfile) {
  const interests = (userProfile.interests || []).join(', ');
  const level = userProfile.level || 'intermediate';

  const prompt = `You are a tech educator. Based on these articles about ${interests}, generate 3-5 key technical insights (tidbits) for a ${level}-level developer.

Articles:
${articles.map((a, i) => `${i + 1}. "${a.title}": ${a.snippet}`).join('\n')}

Format: Return ONLY a numbered list, one tidbit per line. No intro or explanation.`;

  try {
    const response = await queryOllama(prompt);
    return response
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 5);
  } catch (error) {
    console.error('Error generating tidbits:', error.message);
    return ['Unable to generate tidbits at this time'];
  }
}

export async function generateQuestions(userProfile, tidbits) {
  const interests = (userProfile.interests || []).join(', ');
  const level = userProfile.level || 'intermediate';

  const prompt = `You are an interviewer preparing technical questions for a ${level}-level developer interested in ${interests}.

Based on these technical topics: ${tidbits.join('; ')}

Generate 5 interview questions that test practical knowledge and are appropriate for a ${level}-level candidate.

Format: Return ONLY numbered questions, one per line. No intro, explanation, or answers.`;

  try {
    const response = await queryOllama(prompt);
    return response
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 5);
  } catch (error) {
    console.error('Error generating questions:', error.message);
    return ['Unable to generate questions at this time'];
  }
}
