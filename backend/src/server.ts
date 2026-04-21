import { pathToFileURL } from "node:url";

import { buildApp } from "./app.js";
import { loadBackendEnv } from "./config/env.js";

async function startServer() {
  const env = loadBackendEnv();
  const app = buildApp();

  try {
    await app.listen({
      host: "127.0.0.1",
      port: env.port
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const entryPath = process.argv[1];
const isMain = entryPath
  ? import.meta.url === pathToFileURL(entryPath).href
  : false;

if (isMain) {
  void startServer();
}
