"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Package, Search, Loader2, Ban, CheckCircle2 } from "lucide-react";
import { toggleDiscontinued } from "@/app/(authenticated)/catalog/actions";
import { formatCurrency } from "@/lib/constants";
import type { Product } from "@/lib/types";

type CategoryGroup = {
  category: string;
  products: Product[];
};

export function CatalogManager({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [discontinuedFilter, setDiscontinuedFilter] = useState<string>("all");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Extract all unique categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of products) {
      if (p.categories && p.categories.length > 0) {
        for (const c of p.categories) {
          if (c.name) cats.add(c.name);
        }
      }
    }
    return Array.from(cats).sort();
  }, [products]);

  // Filter products
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      // Search filter
      if (q) {
        const name = (p.name || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        if (!name.includes(q) && !sku.includes(q)) return false;
      }
      // Category filter
      if (categoryFilter !== "all") {
        const cats = (p.categories || []).map((c) => c.name);
        if (!cats.includes(categoryFilter)) return false;
      }
      // Discontinued filter
      if (discontinuedFilter === "active" && p.discontinued) return false;
      if (discontinuedFilter === "discontinued" && !p.discontinued) return false;
      return true;
    });
  }, [products, search, categoryFilter, discontinuedFilter]);

  // Group by category
  const grouped = useMemo<CategoryGroup[]>(() => {
    const byCat = new Map<string, Product[]>();
    for (const p of filtered) {
      const cats = (p.categories || []).map((c) => c.name).filter(Boolean);
      const cat = cats.length > 0 ? cats[0] : "Uncategorized";
      const arr = byCat.get(cat) || [];
      arr.push(p);
      byCat.set(cat, arr);
    }
    return Array.from(byCat.entries())
      .map(([category, prods]) => ({ category, products: prods }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [filtered]);

  const discontinuedCount = products.filter((p) => p.discontinued).length;
  const activeCount = products.length - discontinuedCount;

  const handleToggle = (product: Product) => {
    if (!product.discontinued) {
      // Marking as discontinued — show confirmation
      setConfirmProduct(product);
    } else {
      // Reactivating — no confirmation needed
      doToggle(product.woo_id, false);
    }
  };

  const doToggle = (wooId: number, discontinued: boolean) => {
    setPendingId(wooId);
    setError(null);
    setConfirmProduct(null);
    startTransition(async () => {
      const result = await toggleDiscontinued(wooId, discontinued);
      if (!result.ok) {
        setError(result.error);
      }
      setPendingId(null);
    });
  };

  const getImageUrl = (p: Product): string | null => {
    if (!p.images || p.images.length === 0) return null;
    const img = p.images[0];
    return img.public_url || img.src || null;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{products.length}</div>
                <div className="text-xs text-muted-foreground">Total Products</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{activeCount}</div>
                <div className="text-xs text-muted-foreground">Active (visible to bot)</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Ban className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{discontinuedCount}</div>
                <div className="text-xs text-muted-foreground">Discontinued (hidden)</div>
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
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[200px]">
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
        <Select value={discontinuedFilter} onValueChange={(v) => setDiscontinuedFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="discontinued">Discontinued Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Product groups */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-lg mb-1">No products found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <Card key={group.category}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {group.category}
                  <Badge variant="secondary">{group.products.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.products.map((p) => {
                    const imgUrl = getImageUrl(p);
                    const isPendingThis = pendingId === p.woo_id && isPending;
                    return (
                      <div
                        key={p.woo_id}
                        className={`rounded-lg border p-3 space-y-2 ${
                          p.discontinued
                            ? "border-red-200 dark:border-red-900 opacity-60"
                            : "border-border"
                        }`}
                      >
                        <div className="aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium text-sm line-clamp-2">
                            {p.name}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">
                              {p.price > 0
                                ? formatCurrency(Number(p.price))
                                : "Price on request"}
                            </span>
                            {p.discontinued && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                Discontinued
                              </Badge>
                            )}
                          </div>
                          {p.sku && (
                            <div className="text-xs text-muted-foreground">
                              SKU: {p.sku}
                            </div>
                          )}
                          <Button
                            variant={p.discontinued ? "outline" : "destructive"}
                            size="sm"
                            className="w-full mt-2"
                            disabled={isPendingThis}
                            onClick={() => handleToggle(p)}
                          >
                            {isPendingThis ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : p.discontinued ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Reactivate
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4" />
                                Mark Discontinued
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation dialog for marking discontinued */}
      <Dialog
        open={confirmProduct !== null}
        onOpenChange={(open) => !open && setConfirmProduct(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark product as discontinued?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This product will no longer appear in the WhatsApp bot&apos;s
              image carousels when customers browse products. You can reactivate
              it at any time.
            </p>
            {confirmProduct && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="font-medium text-sm">{confirmProduct.name}</div>
                {confirmProduct.sku && (
                  <div className="text-xs text-muted-foreground mt-1">
                    SKU: {confirmProduct.sku}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                confirmProduct &&
                doToggle(confirmProduct.woo_id, true)
              }
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Mark Discontinued"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
