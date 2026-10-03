/**
 * Gemini API integration.
 * Kept in this file for backward compatibility with existing imports.
 */

import axios from 'axios';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS || 60000);

function requireApiKey() {
  if (!API_KEY) throw new Error('GEMINI_API_KEY is not configured');
}

function getErrorMessage(error) {
  return error?.response?.data?.error?.message || error?.message || 'Unknown Gemini API error';
}

function shouldRetry(error) {
  const status = error?.response?.status;
  return status === 408 || status === 429 || status >= 500;
}

export async function queryGemini(prompt, options = {}) {
  requireApiKey();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        API_URL + '/' + MODEL + ':generateContent',
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens || 2048,
          },
        },
        {
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
          timeout: TIMEOUT,
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

      if (!text) {
        const reason = response.data?.promptFeedback?.blockReason;
        throw new Error(reason ? 'Gemini blocked the prompt: ' + reason : 'Empty response from Gemini');
      }

      return text;
    } catch (error) {
      lastError = error;
      console.error('⚠️ Gemini query failed (attempt ' + attempt + '/' + maxRetries + '):', getErrorMessage(error));
      if (attempt < maxRetries && shouldRetry(error)) {
        const waitTime = Math.min(1000 * 2 ** (attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      break;
    }
  }

  throw new Error('Gemini inference failed: ' + getErrorMessage(lastError));
}

export async function getGeminiStatus() {
  requireApiKey();
  try {
    await axios.get(API_URL + '/' + MODEL, {
      headers: { 'x-goog-api-key': API_KEY },
      timeout: 10000,
    });
    return { ready: true, model: MODEL };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('❌ Gemini status check failed:', message);
    throw new Error('Cannot reach Gemini: ' + message);
  }
}

export const queryOllama = queryGemini;
export const getOllamaStatus = getGeminiStatus;
