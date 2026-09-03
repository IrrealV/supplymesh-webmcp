const DGT_SITUATION_PUBLICATION_URL = "https://infocar.dgt.es/datex2/dgt/SituationPublication/all/content.xml";
const REQUEST_TIMEOUT_MS = 8_000;

type VercelRequest = Readonly<{ method?: string }>;
type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== undefined && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).send("Method Not Allowed");
    return;
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(new DOMException("DGT request timed out.", "TimeoutError")), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(DGT_SITUATION_PUBLICATION_URL, {
      headers: {
        Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
        "User-Agent": "SupplyMesh-WebMCP/1.0 (+https://github.com/IrrealV/supplymesh-webmcp)",
      },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      response.status(502).send(`DGT upstream returned HTTP ${upstream.status}.`);
      return;
    }

    const xml = await upstream.text();
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("X-SupplyMesh-Source", "DGT DATEX II");
    response.status(200).send(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DGT proxy failure.";
    response.status(503).send(message);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
