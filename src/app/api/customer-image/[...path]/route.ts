import { NextRequest, NextResponse } from "next/server";
import https from "node:https";

const SUPABASE_HOST = "xzsibbbghotreolzwnyk.supabase.co";

/**
 * Proxies Supabase Storage images through the Next.js server.
 * Returns a JSON response with a base64 data URL.
 *
 * Uses node:https instead of fetch() because Vercel's fetch() serializes
 * binary responses as {"type":"Buffer","data":[...]} JSON, corrupting
 * the image data.
 *
 * Usage: /api/customer-image/storage/v1/object/public/customer-images/...
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = path.join("/");
  const urlPath = `/${fullPath}`;

  try {
    const chunks: Buffer[] = await new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: SUPABASE_HOST,
          path: urlPath,
          method: "GET",
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve(chunks));
          res.on("error", reject);
        }
      );
      req.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);
    const contentType = "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json(
      { dataUrl },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=86400, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
