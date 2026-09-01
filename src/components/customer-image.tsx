"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

/**
 * Renders a customer image by fetching it via the same-origin rewrite proxy
 * and displaying it as a blob URL. This bypasses cross-origin <img> tag
 * loading issues and Vercel binary response serialization issues.
 */
export function CustomerImage({
  src,
  alt,
  href,
}: {
  src: string;
  alt: string;
  href: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setError(false);

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs italic opacity-70">
        <ImageIcon className="h-4 w-4 shrink-0" />
        <span>Image failed to load</span>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="relative rounded-md overflow-hidden border border-border/50 inline-block">
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={alt}
            className="max-h-48 max-w-full object-cover transition-opacity group-hover:opacity-90"
          />
        ) : (
          <div className="w-32 h-32 flex items-center justify-center bg-muted/30">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50 animate-pulse" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
          <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </a>
  );
}
