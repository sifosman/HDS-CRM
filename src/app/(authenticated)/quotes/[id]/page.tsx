import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FileText,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getQuoteById, getQuotePdfUrl } from "@/lib/queries";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
} from "@/lib/constants";

type QuoteSection = {
  material?: string;
  boardSize?: string;
  boardsNeeded?: number;
  pricePerBoard?: number;
  sectionTotal?: number;
  edging?: { length?: number; totalEdging?: number; cost?: number };
  wastage?: {
    boardArea?: number;
    usedArea?: number;
    wasteArea?: number;
    wastePercentage?: number;
    efficiencyPercentage?: number;
  };
};

type QuoteHardwareItem = {
  name?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
};

type QuoteItem = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};

type QuoteTotals = {
  subtotal?: number;
  tax?: number;
  finalTotal?: number;
  grandTotal?: number;
  totalCuttingFee?: number;
  totalEdgingCost?: number;
  hardwareTotal?: number;
};

type QuoteData = {
  sections?: QuoteSection[];
  items?: QuoteItem[];
  hardwareItems?: QuoteHardwareItem[];
  totals?: QuoteTotals;
  branchData?: {
    trading_as?: string;
    branch_address?: string;
    branch_telephone?: string;
    whatsapp?: string | null;
    email_address?: string;
    city?: string;
    province?: string;
  };
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  if (!quote) {
    notFound();
  }

  const pdfUrl = getQuotePdfUrl(quote);
  const quoteData = (quote.quote_data ?? {}) as QuoteData;
  const sections = quoteData.sections ?? [];
  const items = quoteData.items ?? [];
  const hardwareItems = quoteData.hardwareItems ?? [];
  const totals = quoteData.totals ?? {};
  const branch = quoteData.branchData ?? null;

  const cuttingFee = totals.totalCuttingFee ?? 0;
  const edgingCost = totals.totalEdgingCost ?? 0;
  const hardwareTotal = totals.hardwareTotal ?? 0;
  const subtotal = Number(totals.subtotal ?? quote.subtotal ?? 0);
  const tax = Number(totals.tax ?? quote.tax ?? 0);
  const finalTotal = Number(
    totals.finalTotal ?? totals.grandTotal ?? quote.total ?? 0
  );

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <Link href="/quotes">
          <Button variant="ghost" size="sm" className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Quotes
          </Button>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">
              {quote.quote_number || quote.filename || "Quote"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDateTime(quote.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{quote.status || "sent"}</Badge>
            {pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  View PDF
                </Button>
              </a>
            ) : (
              <Button size="sm" disabled>
                <FileText className="h-4 w-4 mr-2" />
                No PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Customer + quote meta */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-medium">
                {quote.customer_name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formatPhone(quote.customer_phone)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{quote.customer_email || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Project name:</span>{" "}
              <span className="font-medium">
                {quote.project_name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{quote.trading_as || quote.branch_trading_as || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Created: {formatDate(quote.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Expires: {formatDate(quote.expires_at ?? quote.expiry_date)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold font-heading">
              {formatCurrency(finalTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              Subtotal {formatCurrency(subtotal)} · VAT {formatCurrency(tax)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Material breakdown */}
      {sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Material Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Board Size</TableHead>
                  <TableHead className="text-right">Boards</TableHead>
                  <TableHead className="text-right">Price / Board</TableHead>
                  <TableHead className="text-right">Edging</TableHead>
                  <TableHead className="text-right">Section Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {s.material || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.boardSize || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.boardsNeeded ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(s.pricePerBoard)}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.edging?.cost
                        ? formatCurrency(s.edging.cost)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(s.sectionTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Hardware & accessories */}
      {hardwareItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hardware &amp; Accessories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hardwareItems.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {h.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {h.sku || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {h.quantity ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(h.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(h.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Line items (legacy) */}
      {items.length > 0 && sections.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {it.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {it.quantity ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(it.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quote summary */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Boards subtotal</span>
              <span className="font-medium">
                {formatCurrency(subtotal - hardwareTotal)}
              </span>
            </div>
            {cuttingFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cutting fee</span>
                <span className="font-medium">{formatCurrency(cuttingFee)}</span>
              </div>
            )}
            {edgingCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Edging</span>
                <span className="font-medium">{formatCurrency(edgingCost)}</span>
              </div>
            )}
            {hardwareTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hardware</span>
                <span className="font-medium">
                  {formatCurrency(hardwareTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">VAT (15%)</span>
              <span className="font-medium">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <span className="font-bold">Grand Total</span>
              <span className="font-bold font-heading">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branch details */}
      {branch && (
        <Card>
          <CardHeader>
            <CardTitle>Branch Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {branch.trading_as || "—"}
                </span>
              </div>
              {branch.branch_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{branch.branch_address}</span>
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {branch.branch_telephone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{branch.branch_telephone}</span>
                </div>
              )}
              {branch.email_address && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{branch.email_address}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF link footer */}
      {pdfUrl && (
        <div className="flex justify-end">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open PDF in new tab
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
