import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { CarpentersTable } from "@/components/carpenters-table";
import { getCarpenters } from "@/lib/queries";

export default async function CarpentersPage() {
  const access = await requireRole(["owner", "manager", "sales"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const carpenters = await getCarpenters();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Carpenter Database</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trade carpenters and installers identified through chatbot conversations —
          used for referrals, promotions, and marketing campaigns
        </p>
      </div>
      <CarpentersTable carpenters={carpenters} />
    </div>
  );
}
