import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://xzsibbbghotreolzwnyk.supabase.co";

/**
 * Proxies Supabase Storage images through the Next.js server so they can be
 * loaded by the browser as same-origin resources. This avoids cross-origin
 * image loading issues that prevent <img> tags from rendering Supabase images.
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
      return new NextResponse("Image not found", { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    // Stream the response body directly through to avoid Buffer JSON serialization
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 500 });
  }
}
