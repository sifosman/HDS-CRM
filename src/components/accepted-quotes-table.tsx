"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, ExternalLink, Scissors } from "lucide-react";
import type { Quote, QuoteAcceptanceMap } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/constants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function quotePdfUrl(q: Quote): string | null {
  if (!q.filename || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/hdsquotes/${encodeURIComponent(q.filename)}`;
}

const SIGNAL_LABELS: Record<string, string> = {
  keyword: "Customer Message",
  lead_status: "Lead Stage",
  both: "Message + Lead Stage",
};

const SIGNAL_COLORS: Record<string, string> = {
  keyword: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  lead_status:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  both: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

export function AcceptedQuotesTable({
  quotes,
  acceptance,
}: {
  quotes: Quote[];
  acceptance: QuoteAcceptanceMap;
}) {
  const [search, setSearch] = useState("");

  const acceptedQuotes = useMemo(() => {
    return quotes
      .filter((q) => acceptance[q.id]?.accepted)
      .filter((q) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          q.quote_number?.toLowerCase().includes(s) ||
          q.customer_name?.toLowerCase().includes(s) ||
          q.customer_phone?.includes(search)
        );
      });
  }, [quotes, acceptance, search]);

  const totalValue = acceptedQuotes.reduce(
    (sum, q) => sum + Number(q.total || 0),
    0
  );
  const avgValue =
    acceptedQuotes.length > 0 ? totalValue / acceptedQuotes.length : 0;

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Accepted Quotes</p>
            <p className="text-xl font-bold font-heading">
              {acceptedQuotes.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-xl font-bold font-heading">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Average Value</p>
            <p className="text-xl font-bold font-heading">
              {formatCurrency(avgValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by quote #, customer name, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Determined By</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Cutlist</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acceptedQuotes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    No customer-accepted quotes yet
                  </TableCell>
                </TableRow>
              )}
              {acceptedQuotes.map((q) => {
                const a = acceptance[q.id];
                const pdfUrl = quotePdfUrl(q);
                return (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/80 active:scale-[0.995]"
                  >
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/quotes/${q.id}`}
                        className="text-primary hover:underline"
                      >
                        {q.quote_number || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/quotes/${q.id}`} className="block">
                        {q.customer_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {q.customer_phone || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(q.total))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(q.created_at)}
                    </TableCell>
                    <TableCell>
                      {a?.signal && (
                        <Badge
                          className={SIGNAL_COLORS[a.signal] || ""}
                          title={`Determined via ${SIGNAL_LABELS[a.signal] || a.signal}`}
                        >
                          {SIGNAL_LABELS[a.signal] || a.signal}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {a?.evidence ? (
                        <span
                          className="text-xs text-muted-foreground block truncate"
                          title={a.evidence}
                        >
                          {a.evidence}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pdfUrl ? (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Quote PDF"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {q.cutlist_url ? (
                        <a
                          href={q.cutlist_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Cutting List PDF"
                        >
                          <Scissors className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
