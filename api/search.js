import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function scrapeDuckDuckGo(q) {
  const urlsToTry = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,
  ];

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://duckduckgo.com/',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`DuckDuckGo failed at ${url} status:${response.status} body:`, body.slice(0, 200));
        continue; // try next URL
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      let results = [];

      if (url.includes('html.duckduckgo.com')) {
        // Original DuckDuckGo lite HTML markup
        $('a.result__a').each((_, el) => {
          const link = $(el).attr('href');
          const title = $(el).text().trim();
          const snippet = $(el).parent().next().find('.result__snippet').text().trim() || '';
          if (link && title) results.push({ title, link, snippet });
        });
      } else if (url.includes('lite.duckduckgo.com')) {
        // Lite version markup: results in table rows
        $('table.result tbody tr').each((_, el) => {
          const title = $(el).find('a').first().text().trim();
          const link = $(el).find('a').first().attr('href');
          const snippet = $(el).find('td.snippet').text().trim() || '';
          if (link && title) results.push({ title, link, snippet });
        });
      }

      if (results.length > 0) return results;
    } catch (e) {
      console.error(`DuckDuckGo error on ${url}:`, e.message);
    }
  }

  throw new Error('All DuckDuckGo mirrors failed');
}

async function scrapeBing(q) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://bing.com/',
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://google.com/',
    },
  });

  if (!response.ok) throw new Error('Google request failed');

  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $('div.g').each((_, el) => {
    const title = $(el).find('h3').text().trim();
    const link = $(el).find('a').attr('href');
    const snippet = $(el).find('.IsZvec, .aCOpRe').text().trim() || '';
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
