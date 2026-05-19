/**
 * Web search integration
 * DuckDuckGo via api.duckduckgo.com
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export async function webSearch(query, limit = 5) {
  try {
    // Using DuckDuckGo API
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_redirect: 1,
        t: 'openclaw'
      },
      timeout: 10000,
    });

    const results = [];
    
    // Parse results
    if (response.data.Results) {
      for (const result of response.data.Results.slice(0, limit)) {
        results.push({
          title: result.Text,
          url: result.FirstURL,
          snippet: result.Result,
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Web search failed:`, error.message);
    throw new Error(`Web search failed: ${error.message}`);
  }
}

export async function fetchContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 50000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (OpenClaw Learning Assistant)'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Extract main content
    const text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit to 5000 chars

    return text;
  } catch (error) {
    console.error(`❌ Fetch failed for ${url}:`, error.message);
    throw error;
  }
}
