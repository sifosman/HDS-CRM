import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getProducts } from "@/lib/queries";
import { CatalogManager } from "@/components/catalog-manager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Product Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the product image catalog shown by the WhatsApp bot. Mark
          discontinued products to hide them from customer carousels.
        </p>
      </div>
      <CatalogManager products={products} />
    </div>
  );
}
