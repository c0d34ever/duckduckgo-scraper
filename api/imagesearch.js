import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { cache, isRateLimited, randomDelay } from "./utils.js";

// DuckDuckGo image search uses a JSON API endpoint
async function scrapeDuckDuckGoImages(q) {
  const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const data = await response.json();

  return data.results.map(({ title, image, thumbnail, url }) => ({
    title,
    image,
    thumbnail,
    url,
  }));
}

async function scrapeBingImages(q) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $("a.iusc").each((_, el) => {
    const m = $(el).attr("m");
    if (!m) return;
    try {
      const meta = JSON.parse(m);
      if (meta && meta.murl) {
        results.push({
          title: meta.t,
          image: meta.murl,
          thumbnail: meta.turl,
          pageUrl: meta.purl,
        });
      }
    } catch {}
  });

  return results;
}

async function scrapeGoogleImages(q) {
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $("img.rg_i").each((_, el) => {
    const image = $(el).attr("data-iurl") || $(el).attr("src");
    const thumbnail = $(el).attr("src");
    if (image) {
      results.push({ image, thumbnail });
    }
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

  const cacheKey = `imagesearch:${engine}:${q}`;
  if (cache.has(cacheKey)) return res.status(200).json(cache.get(cacheKey));

  try {
    await randomDelay();

    let results = [];
    switch (engine.toLowerCase()) {
      case "duckduckgo":
        results = await scrapeDuckDuckGoImages(q);
        break;
      case "bing":
        results = await scrapeBingImages(q);
        break;
      case "google":
        results = await scrapeGoogleImages(q);
        break;
    }

    const data = { type: `${engine.toLowerCase()}_images`, query: q, count: results.length, results };
    cache.set(cacheKey, data);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    console.error("Imagesearch error:", err);
    res.status(500).json({ error: "Failed to fetch image results" });
  }
}
