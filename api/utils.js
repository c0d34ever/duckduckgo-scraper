import {LRUCache} from "lru-cache";

export const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 30 }); // 30 mins cache

const ipRequests = new Map();

export function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 1000 * 60; // 1 min window
  const maxRequests = 10;

  if (!ipRequests.has(ip)) {
    ipRequests.set(ip, []);
  }
  const timestamps = ipRequests.get(ip).filter(t => now - t < windowMs);
  timestamps.push(now);
  ipRequests.set(ip, timestamps);

  return timestamps.length > maxRequests;
}

export function randomDelay() {
  return new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
}

export function randomDuckDuckGoMirror() {
  const mirrors = [
    "https://duckduckgo.com",
    "https://lite.duckduckgo.com"
  ];
  return mirrors[Math.floor(Math.random() * mirrors.length)];
}

