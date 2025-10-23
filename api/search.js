import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { cache, isRateLimited, randomDelay, randomDuckDuckGoMirror } from "./utils.js";

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
    $(".result").each((_, el) => {
      const title = $(el).find(".result__a").text();
      const link = $(el).find(".result__a").attr("href");
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
