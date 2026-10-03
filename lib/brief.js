import { webSearch, fetchContent } from './search.js';
import { generateQuestions, generateTidbits } from './generation.js';

async function sendTelegramLongMessage(sendMessage, userId, message) {
  const maxLength = 4000;
  let remaining = message;

  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf('\n', maxLength);
    if (cut < 1000) cut = maxLength;
    await sendMessage(userId, remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) await sendMessage(userId, remaining);
}

export async function sendDailyBrief({ sendMessage, userId, userProfile }) {
  const interests = (userProfile.interests || ['JavaScript', 'Node.js']).filter(Boolean);
  const allArticles = [];

  for (const interest of interests) {
    try {
      const results = await webSearch(interest + ' latest news ' + new Date().getFullYear(), 5);

      for (const article of results.slice(0, 3)) {
        try {
          article.content = await fetchContent(article.url);
        } catch {
          article.content = article.snippet || '';
        }
        if (!article.content?.trim()) {
          article.content = article.snippet || '';
        }
        allArticles.push(article);
      }
    } catch (error) {
      console.warn('Search failed for ' + interest + ':', error.message);
    }
  }

  if (!allArticles.length) {
    throw new Error('No fresh articles were found for the selected interests.');
  }

  const tidbits = await generateTidbits(allArticles, userProfile);
  const questions = await generateQuestions(userProfile, tidbits);

  const message =
    '📚 Daily Tech Brief — ' + new Date().toLocaleDateString() + '\n\n' +
    '🔥 Today\'s Tidbits:\n' +
    tidbits.map((t, i) => (i + 1) + '. ' + t).join('\n\n') + '\n\n' +
    '❓ Interview Questions:\n' +
    questions.map((q, i) => (i + 1) + '. ' + q).join('\n\n');

  await sendTelegramLongMessage(sendMessage, userId, message);
}
