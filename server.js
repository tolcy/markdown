const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.PORT) || 4173;
const publicDir = path.resolve(__dirname, "public");
const vendorDir = path.resolve(__dirname, "node_modules", "vditor");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function inside(root, requestPath) {
  const cleaned = decodeURIComponent(requestPath.split("?")[0]).replace(/^[/\\]+/, "");
  const full = path.resolve(root, cleaned);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  let filePath;

  if (urlPath.startsWith("/vendor/vditor/")) {
    filePath = inside(vendorDir, urlPath.slice("/vendor/vditor/".length));
  } else {
    const rel = urlPath === "/" ? "index.html" : urlPath;
    filePath = inside(publicDir, rel);
  }

  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      send(res, 404, "Not found");
      return;
    }
    const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, host, () => {
  console.log(`文稿 http://${host}:${port}`);
});
