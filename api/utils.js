import { LRUCache } from "lru-cache";

export const cache = new LRUCache({
  max: 500,             // store up to 500 results
  ttl: 1000 * 60 * 30,  // 30 minutes
});

const requestLog = new Map(); // basic rate limiter

export function isRateLimited(ip, limit = 30, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  if (!requestLog.has(ip)) requestLog.set(ip, []);
  const timestamps = requestLog.get(ip).filter((t) => t > windowStart);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > limit;
}

export async function randomDelay(min = 200, max = 800) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((r) => setTimeout(r, ms));
}

export function randomDuckDuckGoMirror() {
  const mirrors = [
    "https://html.duckduckgo.com/html/",
    "https://lite.duckduckgo.com/lite/",
    "https://start.duckduckgo.com/html/"
  ];
  return mirrors[Math.floor(Math.random() * mirrors.length)];
}
