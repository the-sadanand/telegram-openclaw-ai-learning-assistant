/**
 * Web search integration
 * DuckDuckGo HTML search with API fallback.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (OpenClaw Learning Assistant)',
};

export async function webSearch(query, limit = 5) {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: HEADERS,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('.result').slice(0, limit).each((_, el) => {
      const link = $(el).find('.result__a').first();
      let url = link.attr('href');
      if (url?.startsWith('//')) url = 'https:' + url;
      if (url?.startsWith('/')) url = 'https://html.duckduckgo.com' + url;
      const title = link.text().trim();
      const snippet = $(el).find('.result__snippet').first().text().trim();

      if (url && title) results.push({ title, url, snippet });
    });

    if (results.length) return results;
  } catch (error) {
    console.warn('DuckDuckGo HTML search failed:', error.message);
  }

  try {
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_redirect: 1,
        t: 'openclaw',
      },
      headers: HEADERS,
      timeout: 10000,
    });

    const results = [];
    for (const result of response.data?.Results?.slice(0, limit) || []) {
      results.push({
        title: result.Text,
        url: result.FirstURL,
        snippet: result.Result,
      });
    }

    return results;
  } catch (error) {
    console.error('❌ Web search failed:', error.message);
    throw new Error('Web search failed: ' + error.message);
  }
}

export async function fetchContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 2 * 1024 * 1024,
      headers: HEADERS,
    });

    const $ = cheerio.load(response.data);
    return $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000);
  } catch (error) {
    console.error('❌ Fetch failed for ' + url + ':', error.message);
    throw error;
  }
}
