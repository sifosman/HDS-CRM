import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getWilliamPrices } from "@/lib/queries";
import { WilliamPricingManager } from "@/components/william-pricing-manager";

export const dynamic = "force-dynamic";

export default async function WilliamPricingPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const prices = await getWilliamPrices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">William Pricing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Product pricing used by the William WhatsApp bot. Prices edited here
          take effect immediately in William&apos;s quotes.
        </p>
      </div>
      <WilliamPricingManager prices={prices} />
    </div>
  );
}
