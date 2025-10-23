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

export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });

  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const cacheKey = `search:${q}`;
  if (cache.has(cacheKey)) return res.status(200).json(cache.get(cacheKey));

  const base = randomDuckDuckGoMirror();
  const url = `${base}?q=${encodeURIComponent(q)}`;

  try {
    await randomDelay();
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

    const data = { type: "web", query: q, count: results.length, results };
    cache.set(cacheKey, data);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to fetch results" });
  }
}
