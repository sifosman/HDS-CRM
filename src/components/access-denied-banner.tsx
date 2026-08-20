"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reads the `error` query param from the URL and shows a dismissible banner.
 * Currently supports `access_denied` — the proxy/page guards redirect with
 * this flag when a user tries to access a page their role doesn't allow.
 */
export function AccessDeniedBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const error = searchParams.get("error");

  useEffect(() => {
    if (error === "access_denied") setVisible(true);
  }, [error]);

  if (!visible || error !== "access_denied") return null;

  function dismiss() {
    setVisible(false);
    // Remove the query param from the URL without a full reload.
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    router.replace(url.pathname + (url.search ? url.search : ""));
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium flex-1">
        You don&apos;t have permission to access that page.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
