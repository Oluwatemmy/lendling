// Minimal static server for the LENDLING site: `node server.mjs` -> http://localhost:5173
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = +process.env.PORT || 5173;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg" };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  const file = join(root, path || "index.html");
  if (!file.startsWith(root)) return res.writeHead(403).end();
  let size;
  try { size = statSync(file).size; } catch { return res.writeHead(404).end("Not found"); }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Content-Length": size, "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`LENDLING running at http://localhost:${port}`));
