import { NextRequest } from "next/server";

/**
 * Proxy hacia el backend FastAPI.
 *
 * En producción `BACKEND_URL` apunta al Space de Hugging Face (o a donde esté
 * desplegado el servicio). Mantenerlo en el servidor evita configurar CORS y
 * expone una sola URL pública: la del frontend.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const BACKEND = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(290_000),
    });

    const payload = await res.arrayBuffer();
    return new Response(payload, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fallo de conexión";
    return Response.json(
      { detail: `No se pudo contactar al backend (${BACKEND}): ${message}` },
      { status: 502 },
    );
  }
}

export { handler as GET, handler as POST };
