import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { cache, isRateLimited, randomDelay, randomDuckDuckGoMirror } from "./utils.js";

function cleanDuckDuckGoLink(href) {
  if (!href) return href;
  try {
    const url = new URL(href, "https://duckduckgo.com");
    if (url.pathname === "/l/") {
      const actualUrl = url.searchParams.get("uddg");
      return actualUrl ? decodeURIComponent(actualUrl) : href;
    }
    return href;
  } catch {
    return href;
  }
}

async function scrapeDuckDuckGo(q) {
  const base = randomDuckDuckGoMirror();
  const url = `${base}?q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $(".result__body").each((_, el) => {
    const title = $(el).find(".result__a").text();
    const rawLink = $(el).find(".result__a").attr("href");
    const link = cleanDuckDuckGoLink(rawLink);
    const snippet = $(el).find(".result__snippet").text();
    if (title && link) results.push({ title, link, snippet });
  });

  return results;
}

async function scrapeBing(q) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $("li.b_algo").each((_, el) => {
    const title = $(el).find("h2 a").text();
    const link = $(el).find("h2 a").attr("href");
    const snippet = $(el).find(".b_caption p").text();
    if (title && link) results.push({ title, link, snippet });
  });

  return results;
}

async function scrapeGoogle(q) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $("div.g").each((_, el) => {
    const title = $(el).find("h3").text();
    const link = $(el).find("a").attr("href");
    const snippet = $(el).find(".VwiC3b").text();
    if (title && link) results.push({ title, link, snippet });
  });

  return results;
}

export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const { q, engine = "duckduckgo" } = req.query;

  if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });

  const supportedEngines = ["duckduckgo", "bing", "google"];
  if (!supportedEngines.includes(engine.toLowerCase())) {
    return res.status(400).json({ error: `Invalid engine. Must be one of ${supportedEngines.join(", ")}` });
  }

  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const cacheKey = `websearch:${engine}:${q}`;
  if (cache.has(cacheKey)) return res.status(200).json(cache.get(cacheKey));

  try {
    await randomDelay();

    let results = [];
    switch (engine.toLowerCase()) {
      case "duckduckgo":
        results = await scrapeDuckDuckGo(q);
        break;
      case "bing":
        results = await scrapeBing(q);
        break;
      case "google":
        results = await scrapeGoogle(q);
        break;
    }

    const data = { type: engine.toLowerCase(), query: q, count: results.length, results };
    cache.set(cacheKey, data);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    console.error("Websearch error:", err);
    res.status(500).json({ error: "Failed to fetch web results" });
  }
}
