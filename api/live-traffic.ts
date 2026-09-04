type ApiRequest = Readonly<{ method?: string }>;
type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
  json(body: unknown): void;
  end(): void;
};

const DGT_DATEX_SOURCES = [
  "https://infocar.dgt.es/datex2/v3/dgt/SituationPublication/incidencias.xml",
  "https://infocar.dgt.es/datex2/dgt/SituationPublication/all/content.xml",
  "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml",
  "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml",
] as const;

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Accept");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== undefined && request.method !== "GET") {
    response.status(405).json({ error: "method-not-allowed" });
    return;
  }

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

      response.setHeader("Content-Type", "application/xml; charset=utf-8");
      response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=240");
      response.setHeader("X-SupplyMesh-Source", source);
      response.status(200).send(xml);
      return;
    } catch (error) {
      failures.push(`${new URL(source).hostname}:${error instanceof Error ? error.name : "fetch-error"}`);
    }
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(502).json({
    error: "dgt-live-feed-unavailable",
    providersTried: failures,
  });
}
