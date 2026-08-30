"use client";

import { useMemo, useState } from "react";
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
import { Search, Star } from "lucide-react";
import type { Carpenter } from "@/lib/types";
import {
  TRADE_TYPE_LABELS,
  TRADE_TYPE_COLORS,
  formatPhone,
  formatDate,
} from "@/lib/constants";

export function CarpentersTable({ carpenters }: { carpenters: Carpenter[] }) {
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const tradeTypes = useMemo(() => {
    const unique = Array.from(
      new Set(carpenters.map((c) => c.trade_type).filter(Boolean))
    ).sort();
    return unique;
  }, [carpenters]);

  const filtered = useMemo(() => {
    return carpenters.filter((c) => {
      const matchesSearch =
        !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search) ||
        c.branch?.toLowerCase().includes(search.toLowerCase());
      const matchesTrade =
        tradeFilter === "all" || c.trade_type === tradeFilter;
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && c.is_active) ||
        (activeFilter === "inactive" && !c.is_active);
      return matchesSearch && matchesTrade && matchesActive;
    });
  }, [carpenters, search, tradeFilter, activeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tradeFilter} onValueChange={(v) => setTradeFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Trade Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {tradeTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {TRADE_TYPE_LABELS[t] || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Trade Type</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No carpenters found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((carpenter) => (
                <TableRow key={carpenter.id}>
                  <TableCell className="font-medium">
                    {carpenter.name || "Unknown"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPhone(carpenter.phone_number)}
                  </TableCell>
                  <TableCell>
                    <Badge className={TRADE_TYPE_COLORS[carpenter.trade_type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}>
                      {TRADE_TYPE_LABELS[carpenter.trade_type] || carpenter.trade_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {carpenter.branch || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {carpenter.rating > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {carpenter.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {carpenter.referral_count}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        carpenter.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }
                    >
                      {carpenter.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(carpenter.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {carpenters.length} carpenters
      </p>
    </div>
  );
}
