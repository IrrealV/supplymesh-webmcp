import type { ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const DGT_DATEX_SOURCES = [
  "https://infocar.dgt.es/datex2/v3/dgt/SituationPublication/incidencias.xml",
  "https://infocar.dgt.es/datex2/dgt/SituationPublication/all/content.xml",
  "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml",
  "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml",
] as const;

async function sendDgtTraffic(response: ServerResponse): Promise<void> {
  const failures: string[] = [];
  for (const source of DGT_DATEX_SOURCES) {
    try {
      const upstream = await fetch(source, {
        headers: {
          accept: "application/xml,text/xml;q=0.9,*/*;q=0.5",
          "user-agent": "SupplyMesh-WebMCP/1.0 (+https://github.com/IrrealV/supplymesh-webmcp)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (!upstream.ok) {
        failures.push(`${new URL(source).hostname}:${upstream.status}`);
        continue;
      }
      const xml = await upstream.text();
      if (!xml.includes("<") || (!xml.includes("situation") && !xml.includes("SituationPublication"))) {
        failures.push(`${new URL(source).hostname}:invalid-xml`);
        continue;
      }
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/xml; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-SupplyMesh-Source", source);
      response.end(xml);
      return;
    } catch (error) {
      failures.push(`${new URL(source).hostname}:${error instanceof Error ? error.name : "fetch-error"}`);
    }
  }

  response.statusCode = 502;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ error: "dgt-live-feed-unavailable", providersTried: failures }));
}

function liveTrafficProxy(): Plugin {
  const install = (server: { middlewares: { use(path: string, handler: (_request: unknown, response: ServerResponse) => void): void } }): void => {
    server.middlewares.use("/api/live-traffic", (_request, response) => { void sendDgtTraffic(response); });
  };
  return {
    name: "supplymesh-live-traffic-proxy",
    configureServer: install,
    configurePreviewServer: install,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), liveTrafficProxy()],
});
