import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { cache, isRateLimited, randomDelay, randomDuckDuckGoMirror } from "./utils.js";

// Bing news scraper
async function scrapeBingNews(q) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $("div.news-card").each((_, el) => {
    const title = $(el).find("a.title").text();
    const link = $(el).find("a.title").attr("href");
    const source = $(el).find("div.source").text().trim();
    const snippet = $(el).find("div.snippet").text();
    const time = $(el).find("span.time").text();

    if (title && link) {
      results.push({ title, link, source, snippet, time });
    }
  });

  return results;
}

// DuckDuckGo news scraper
async function scrapeDuckDuckGoNews(q) {
  // DuckDuckGo news URL structure
  const base = randomDuckDuckGoMirror();
  const url = `${base}/?q=${encodeURIComponent(q)}&ia=news`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $("div.result--news").each((_, el) => {
    const title = $(el).find("a.result__a").text();
    const rawLink = $(el).find("a.result__a").attr("href");
    const link = rawLink && rawLink.startsWith("http") ? rawLink : null;
    const source = $(el).find("span.result__source").text();
    const snippet = $(el).find("div.result__snippet").text();
    if (title && link) {
      results.push({ title, link, source, snippet });
    }
  });

  return results;
}

export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const { q, engine = "bing" } = req.query;

  if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });

  const supportedEngines = ["bing", "duckduckgo"];
  if (!supportedEngines.includes(engine.toLowerCase())) {
    return res.status(400).json({ error: `Invalid engine. Must be one of ${supportedEngines.join(", ")}` });
  }

  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const cacheKey = `newssearch:${engine}:${q}`;
  if (cache.has(cacheKey)) return res.status(200).json(cache.get(cacheKey));

  try {
    await randomDelay();

    let results = [];
    switch (engine.toLowerCase()) {
      case "bing":
        results = await scrapeBingNews(q);
        break;
      case "duckduckgo":
        results = await scrapeDuckDuckGoNews(q);
        break;
    }

    const data = { type: `${engine.toLowerCase()}_news`, query: q, count: results.length, results };
    cache.set(cacheKey, data);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    console.error("Newssearch error:", err);
    res.status(500).json({ error: "Failed to fetch news results" });
  }
}
