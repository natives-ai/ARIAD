import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const frontendHost = process.env.ARIAD_FRONTEND_HOST ?? "127.0.0.1";
const frontendPort = Number(process.env.ARIAD_FRONTEND_PORT ?? "5173");
const rootDir = process.cwd();
const standalonePath = join(rootDir, "ARIAD.html");
const helperPath = join(rootDir, "OPEN-ARIAD.html");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

function sendFile(response, filePath) {
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream"
  });

  createReadStream(filePath).pipe(response);
}

if (!existsSync(standalonePath)) {
  console.error("[ARIAD] ARIAD.html is missing.");
  process.exit(1);
}

const server = createServer((request, response) => {
  const pathname = new URL(
    request.url ?? "/",
    `http://${frontendHost}:${frontendPort}`
  ).pathname;

  if (pathname === "/open" || pathname === "/open.html") {
    if (existsSync(helperPath)) {
      sendFile(response, helperPath);
      return;
    }
  }

  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/service.html"
  ) {
    sendFile(response, standalonePath);
    return;
  }

  response.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("not_found");
});

server.listen(frontendPort, frontendHost, () => {
  console.log(
    `[ARIAD] Standalone compatibility server listening on http://${frontendHost}:${frontendPort}`
  );
  console.log("[ARIAD] Compatibility mode is serving ARIAD.html.");
});
