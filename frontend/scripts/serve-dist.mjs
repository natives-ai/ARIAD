/* global URL, console, process */

import { createServer, request as httpRequest } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const frontendHost = process.env.SCENAAIRO_FRONTEND_HOST ?? "127.0.0.1";
const frontendPort = Number(process.env.SCENAAIRO_FRONTEND_PORT ?? "5173");
const backendHost = process.env.SCENAAIRO_BACKEND_HOST ?? "127.0.0.1";
const backendPort = Number(process.env.SCENAAIRO_BACKEND_PORT ?? "3001");

const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = join(frontendRoot, "dist");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"]
]);

function getContentType(filePath) {
  return contentTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function resolveDistPath(urlPath) {
  if (urlPath === "/" || urlPath === "") {
    return join(distRoot, "index.html");
  }

  if (urlPath === "/service.html") {
    return join(distRoot, "service.html");
  }

  if (urlPath === "/auth/callback") {
    return join(distRoot, "index.html");
  }

  if (!extname(urlPath)) {
    return join(distRoot, "index.html");
  }

  const normalizedPath = normalize(urlPath.replace(/^\/+/, ""));
  const absolutePath = join(distRoot, normalizedPath);

  if (!absolutePath.startsWith(distRoot)) {
    return null;
  }

  return absolutePath;
}

function proxyApiRequest(clientRequest, clientResponse) {
  const proxyRequest = httpRequest(
    {
      headers: clientRequest.headers,
      host: backendHost,
      method: clientRequest.method,
      path: clientRequest.url,
      port: backendPort
    },
    (proxyResponse) => {
      clientResponse.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(clientResponse);
    }
  );

  proxyRequest.on("error", (error) => {
    clientResponse.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8"
    });
    clientResponse.end(
      JSON.stringify({
        message: "proxy_failed",
        detail: error instanceof Error ? error.message : String(error)
      })
    );
  });

  clientRequest.pipe(proxyRequest);
}

function serveStaticFile(clientRequest, clientResponse) {
  const requestUrl = new URL(clientRequest.url ?? "/", `http://${frontendHost}:${frontendPort}`);
  const filePath = resolveDistPath(requestUrl.pathname);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    clientResponse.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    clientResponse.end("not_found");
    return;
  }

  clientResponse.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": getContentType(filePath)
  });

  createReadStream(filePath).pipe(clientResponse);
}

if (!existsSync(join(distRoot, "service.html"))) {
  console.error("[SCENAAIRO] frontend/dist/service.html is missing.");
  console.error("[SCENAAIRO] Run `npm run build` before starting the dist server.");
  process.exit(1);
}

const server = createServer((clientRequest, clientResponse) => {
  if ((clientRequest.url ?? "").startsWith("/api")) {
    proxyApiRequest(clientRequest, clientResponse);
    return;
  }

  serveStaticFile(clientRequest, clientResponse);
});

server.listen(frontendPort, frontendHost, () => {
  console.log(
    `[SCENAAIRO] Dist server listening on http://${frontendHost}:${frontendPort}`
  );
  console.log(
    `[SCENAAIRO] Proxying /api to http://${backendHost}:${backendPort}`
  );
});
