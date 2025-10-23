import fetch from 'node-fetch';

const BING_API_KEY = process.env.BING_API_KEY; // Add your Bing API key in Vercel env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Add your Google API key
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID; // Add your Custom Search Engine ID

export default async function handler(req, res) {
  const { q, engine = 'duckduckgo' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing ?q= parameter' });

  try {
    let data;

    if (engine === 'duckduckgo') {
      // DuckDuckGo Instant Answer API
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
      const response = await fetch(url);
      data = await response.json();

      // Simplify and map results (topics)
      const results = (data.RelatedTopics || []).flatMap(topic => {
        if (topic.Topics) {
          // Some RelatedTopics are nested
          return topic.Topics.map(t => ({
            text: t.Text,
            url: t.FirstURL,
          }));
        }
        return [{
          text: topic.Text,
          url: topic.FirstURL,
        }];
      });

      return res.status(200).json({
        type: 'duckduckgo',
        query: q,
        results,
      });

    } else if (engine === 'bing') {
      if (!BING_API_KEY) return res.status(500).json({ error: 'Bing API key not configured' });

      const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(q)}`;
      const response = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY }
      });
      data = await response.json();

      const results = (data.webPages?.value || []).map(item => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
      }));

      return res.status(200).json({
        type: 'bing',
        query: q,
        results,
      });

    } else if (engine === 'google') {
      if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
        return res.status(500).json({ error: 'Google API key or CSE ID not configured' });
      }

      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(q)}`;
      const response = await fetch(url);
      data = await response.json();

      const results = (data.items || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      }));

      return res.status(200).json({
        type: 'google',
        query: q,
        results,
      });

    } else {
      return res.status(400).json({ error: 'Unsupported search engine' });
    }

  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
}
