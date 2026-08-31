"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye } from "lucide-react";
import type { CustomerProfile, CustomerQuoteBreakdownMap } from "@/lib/types";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_COLORS,
  formatCurrency,
  formatPhone,
  formatLastMessage,
} from "@/lib/constants";

function CustomersTableInner({
  customers,
  quoteBreakdown = {},
}: {
  customers: CustomerProfile[];
  quoteBreakdown?: CustomerQuoteBreakdownMap;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read filter values from URL search params (with sensible defaults)
  const search = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const cityFilter = searchParams.get("city") ?? "all";

  // Build the current filter query string (for passing to detail links)
  const filterQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (cityFilter !== "all") params.set("city", cityFilter);
    const str = params.toString();
    return str;
  }, [search, statusFilter, typeFilter, cityFilter]);

  // Update a single filter value in the URL
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `/customers?${qs}` : "/customers", { scroll: false });
    },
    [searchParams, router],
  );

  // Extract unique cities for the filter dropdown
  const cities = useMemo(() => {
    const unique = Array.from(
      new Set(
        customers
          .map((c) => c.city)
          .filter((c): c is string => c !== null && c.trim() !== "")
      )
    ).sort();
    return unique;
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search);
      const matchesStatus =
        statusFilter === "all" || c.lead_status === statusFilter;
      const matchesType =
        typeFilter === "all" || c.customer_type === typeFilter;
      const matchesCity =
        cityFilter === "all" || c.city === cityFilter;
      return matchesSearch && matchesStatus && matchesType && matchesCity;
    });
  }, [customers, search, statusFilter, typeFilter, cityFilter]);

  // Build the detail page href with filter state preserved
  const detailHref = (phone: string) => {
    const encoded = encodeURIComponent(phone);
    return filterQueryString
      ? `/customers/${encoded}?from=${encodeURIComponent(filterQueryString)}`
      : `/customers/${encoded}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => updateFilter("status", v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Lead Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(LEAD_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => updateFilter("type", v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Customer Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(CUSTOMER_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cities.length > 0 && (
          <Select value={cityFilter} onValueChange={(v) => updateFilter("city", v ?? "all")}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%] truncate">Name</TableHead>
                <TableHead className="w-[12%] truncate">Phone</TableHead>
                <TableHead className="w-[10%] truncate">Type</TableHead>
                <TableHead className="w-[7%] text-right truncate">Converted</TableHead>
                <TableHead className="w-[7%] text-right truncate">Pending</TableHead>
                <TableHead className="w-[6%] text-right truncate">Sent</TableHead>
                <TableHead className="w-[8%] text-right truncate">Total</TableHead>
                <TableHead className="w-[10%] text-right truncate">Total Value</TableHead>
                <TableHead className="w-[10%] truncate">Lead Status</TableHead>
                <TableHead className="w-[10%] truncate">Last Message</TableHead>
                <TableHead className="w-[2%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((customer) => {
                const breakdown = quoteBreakdown[customer.phone_number];
                const converted = breakdown?.converted ?? 0;
                const pending = breakdown?.pending ?? 0;
                const sent = breakdown?.sent ?? 0;
                const totalQuotes = breakdown?.total ?? customer.total_quotes ?? 0;
                return (
                <TableRow key={customer.id} className="cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/80 active:scale-[0.995]">
                  <TableCell className="font-medium truncate max-w-0">
                    <Link
                      href={detailHref(customer.phone_number)}
                      className="hover:underline truncate block"
                    >
                      {customer.name || "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap truncate max-w-0">
                    {formatPhone(customer.phone_number)}
                  </TableCell>
                  <TableCell className="truncate max-w-0">
                    <Badge className={CUSTOMER_TYPE_COLORS[customer.customer_type || "unknown"] || CUSTOMER_TYPE_COLORS.unknown}>
                      {CUSTOMER_TYPE_LABELS[customer.customer_type || "unknown"] ||
                        "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className={converted > 0 ? "font-medium text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                      {converted}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className={pending > 0 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                      {pending}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className={sent > 0 ? "font-medium text-blue-600 dark:text-blue-400" : "text-muted-foreground"}>
                      {sent}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {totalQuotes}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatCurrency(customer.total_quote_value)}
                  </TableCell>
                  <TableCell className="truncate max-w-0">
                    {customer.lead_status && (
                      <Badge
                        className={LEAD_STATUS_COLORS[customer.lead_status]}
                        variant="secondary"
                      >
                        {LEAD_STATUS_LABELS[customer.lead_status] ||
                          customer.lead_status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap truncate max-w-0">
                    {formatLastMessage(customer.last_interaction_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={detailHref(customer.phone_number)}>
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {customers.length} customers
      </p>
    </div>
  );
}

export function CustomersTable({
  customers,
  quoteBreakdown = {},
}: {
  customers: CustomerProfile[];
  quoteBreakdown?: CustomerQuoteBreakdownMap;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or phone..." className="pl-9" disabled />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="text-center text-muted-foreground py-8">
                Loading customers...
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CustomersTableInner customers={customers} quoteBreakdown={quoteBreakdown} />
    </Suspense>
  );
}
