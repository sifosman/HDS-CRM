"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tag, Search, Loader2, Check, X, Pencil } from "lucide-react";
import { updateWilliamPrice } from "@/app/(authenticated)/william-pricing/actions";
import { formatCurrency } from "@/lib/constants";
import type { WilliamPrice } from "@/lib/types";

type SortKey = "description-asc" | "price-asc" | "price-desc" | "category-asc";

export function WilliamPricingManager({ prices }: { prices: WilliamPrice[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("description-asc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Unique categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of prices) {
      if (p.category) cats.add(p.category);
    }
    return Array.from(cats).sort();
  }, [prices]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = prices.filter((p) => {
      if (q) {
        const desc = (p.description || "").toLowerCase();
        const code = (p.code || "").toLowerCase();
        const cat = (p.category || "").toLowerCase();
        if (!desc.includes(q) && !code.includes(q) && !cat.includes(q)) {
          return false;
        }
      }
      if (categoryFilter !== "all" && p.category !== categoryFilter) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    switch (sortKey) {
      case "price-asc":
        sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case "price-desc":
        sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case "category-asc":
        sorted.sort(
          (a, b) =>
            (a.category || "").localeCompare(b.category || "") ||
            (a.description || "").localeCompare(b.description || "")
        );
        break;
      case "description-asc":
      default:
        sorted.sort((a, b) =>
          (a.description || "").localeCompare(b.description || "")
        );
        break;
    }
    return sorted;
  }, [prices, search, categoryFilter, sortKey]);

  // Stats
  const totalValue = prices.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const avgValue = prices.length > 0 ? totalValue / prices.length : 0;

  const startEdit = (p: WilliamPrice) => {
    setEditingId(p.ID);
    setEditValue(String(p.price ?? 0));
    setError(null);
    setSuccessId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = (id: number) => {
    const num = parseFloat(editValue);
    if (!Number.isFinite(num) || num < 0) {
      setError("Price must be a positive number");
      return;
    }
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await updateWilliamPrice(id, num);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccessId(id);
        setEditingId(null);
        setEditValue("");
        // Clear success highlight after a moment
        setTimeout(() => setSuccessId(null), 2000);
      }
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Tag className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{prices.length}</div>
                <div className="text-xs text-muted-foreground">Total Products</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(avgValue)}
                </div>
                <div className="text-xs text-muted-foreground">Average Price</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalValue)}
                </div>
                <div className="text-xs text-muted-foreground">Catalog Value</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, code, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="description-asc">Description (A–Z)</SelectItem>
            <SelectItem value="category-asc">Category (A–Z)</SelectItem>
            <SelectItem value="price-asc">Price (Low–High)</SelectItem>
            <SelectItem value="price-desc">Price (High–Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Showing {filtered.length} of {prices.length} products
        </span>
        {categoryFilter !== "all" && (
          <Badge variant="secondary">{categoryFilter}</Badge>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-lg mb-1">No products found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[150px]">Category</TableHead>
                  <TableHead className="w-[140px]">Dimensions</TableHead>
                  <TableHead className="w-[120px]">Material</TableHead>
                  <TableHead className="w-[140px] text-right">Price</TableHead>
                  <TableHead className="w-[80px] text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const isEditing = editingId === p.ID;
                  const isPendingThis = pendingId === p.ID && isPending;
                  const justSaved = successId === p.ID;
                  return (
                    <TableRow
                      key={p.ID}
                      className={
                        justSaved
                          ? "bg-emerald-50 dark:bg-emerald-950/30"
                          : undefined
                      }
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.code || "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.description || "—"}
                      </TableCell>
                      <TableCell>
                        {p.category ? (
                          <Badge variant="outline" className="text-xs">
                            {p.category}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.dimensions || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.material_type || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-muted-foreground">R</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 w-24 text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(p.ID);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              disabled={isPendingThis}
                            />
                          </div>
                        ) : (
                          <span
                            className={
                              justSaved
                                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                : "font-semibold"
                            }
                          >
                            {formatCurrency(Number(p.price ?? 0))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600"
                              onClick={() => saveEdit(p.ID)}
                              disabled={isPendingThis}
                              aria-label="Save price"
                            >
                              {isPendingThis ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={cancelEdit}
                              disabled={isPendingThis}
                              aria-label="Cancel edit"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(p)}
                            disabled={isPending}
                            aria-label="Edit price"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
