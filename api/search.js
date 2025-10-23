import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function scrapeDuckDuckGo(q) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) throw new Error('DuckDuckGo request failed');

  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $('a.result__a').each((_, el) => {
    const link = $(el).attr('href');
    const title = $(el).text().trim();
    const snippet = $(el).parent().next('a.result__snippet, div.result__snippet').text().trim() || '';
    if (link && title) {
      results.push({ title, link, snippet });
    }
  });
  return results;
}

async function scrapeBing(q) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) throw new Error('Bing request failed');

  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $('#b_results > li.b_algo').each((_, el) => {
    const title = $(el).find('h2 > a').text().trim();
    const link = $(el).find('h2 > a').attr('href');
    const snippet = $(el).find('.b_caption p').text().trim() || '';
    if (link && title) {
      results.push({ title, link, snippet });
    }
  });
  return results;
}

async function scrapeGoogle(q) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) throw new Error('Google request failed');

  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $('div.g').each((_, el) => {
    const title = $(el).find('h3').text().trim();
    const link = $(el).find('a').attr('href');
    const snippet = $(el).find('.IsZvec').text().trim() || '';
    if (link && title) {
      results.push({ title, link, snippet });
    }
  });
  return results;
}

export default async function handler(req, res) {
  const { q, engine = 'duckduckgo' } = req.query;

  if (!q) return res.status(400).json({ error: 'Missing ?q= parameter' });

  try {
    let results;
    if (engine === 'duckduckgo') {
      results = await scrapeDuckDuckGo(q);
    } else if (engine === 'bing') {
      results = await scrapeBing(q);
    } else if (engine === 'google') {
      results = await scrapeGoogle(q);
    } else {
      return res.status(400).json({ error: 'Unsupported search engine' });
    }

    res.status(200).json({
      type: engine,
      query: q,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Search scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch results', details: error.message });
  }
}
