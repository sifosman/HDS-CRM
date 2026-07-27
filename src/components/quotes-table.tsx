"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, ExternalLink } from "lucide-react";
import type { Quote } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/constants";

export function QuotesTable({ quotes }: { quotes: Quote[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchesSearch =
        !search ||
        q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer_phone?.includes(search);
      const matchesStatus =
        statusFilter === "all" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  const totalValue = filtered.reduce(
    (sum, q) => sum + Number(q.total || 0),
    0
  );
  const avgValue = filtered.length > 0 ? totalValue / filtered.length : 0;

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Quote Value</p>
            <p className="text-xl font-bold font-heading">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Average Quote Value</p>
            <p className="text-xl font-bold font-heading">
              {formatCurrency(avgValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Quotes</p>
            <p className="text-xl font-bold font-heading">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by quote #, customer name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead className="text-right">Total (incl VAT)</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No quotes found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">
                    {q.quote_number || "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {q.customer_name || "—"}
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
                    <Badge variant="secondary">{q.status || "sent"}</Badge>
                  </TableCell>
                  <TableCell>
                    {q.cutlist_url ? (
                      <a
                        href={q.cutlist_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
