import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://xzsibbbghotreolzwnyk.supabase.co";

/**
 * Proxies Supabase Storage images through the Next.js server.
 * Returns a JSON response with a base64 data URL that the client can use
 * directly as an <img> src. This avoids Vercel's binary response serialization
 * issues that corrupt image data when returned directly from API routes.
 *
 * Usage: /api/customer-image/storage/v1/object/public/customer-images/...
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fullPath = path.join("/");
  const supabaseUrl = `${SUPABASE_URL}/${fullPath}`;

  try {
    const response = await fetch(supabaseUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
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
