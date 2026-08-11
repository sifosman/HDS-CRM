"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import type { CustomerProfile } from "@/lib/types";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_COLORS,
  formatCurrency,
  formatDate,
  formatPhone,
} from "@/lib/constants";

export function CustomersTable({ customers }: { customers: CustomerProfile[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
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
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
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
          <Select value={cityFilter} onValueChange={(v) => setCityFilter(v ?? "all")}>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Lead Status</TableHead>
                <TableHead>Last Interaction</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((customer) => (
                <TableRow key={customer.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${encodeURIComponent(customer.phone_number)}`}
                      className="hover:underline"
                    >
                      {customer.name || "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPhone(customer.phone_number)}
                  </TableCell>
                  <TableCell>
                    <Badge className={CUSTOMER_TYPE_COLORS[customer.customer_type || "unknown"] || CUSTOMER_TYPE_COLORS.unknown}>
                      {CUSTOMER_TYPE_LABELS[customer.customer_type || "unknown"] ||
                        "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {customer.total_quotes}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(customer.total_quote_value)}
                  </TableCell>
                  <TableCell>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(customer.last_interaction_at)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/customers/${encodeURIComponent(customer.phone_number)}`}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
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
