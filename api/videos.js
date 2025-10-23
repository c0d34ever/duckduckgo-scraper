import fetch from "node-fetch";
import { cache, isRateLimited, randomDelay } from "./utils.js";

export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing ?q= parameter" });
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const cacheKey = `videos:${q}`;
  if (cache.has(cacheKey)) return res.status(200).json(cache.get(cacheKey));

  const endpoint = `https://duckduckgo.com/v.js?q=${encodeURIComponent(q)}&iar=videos&ia=videos`;

  try {
    await randomDelay();
    const response = await fetch(endpoint, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await response.json();

    const results = data.results.map((v) => ({
      title: v.title,
      url: v.url,
      source: v.source,
      description: v.description,
      duration: v.duration,
      image: v.image,
      published: v.published,
    }));

    const payload = { type: "videos", query: q, count: results.length, results };
    cache.set(cacheKey, payload);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch video results" });
  }
}
