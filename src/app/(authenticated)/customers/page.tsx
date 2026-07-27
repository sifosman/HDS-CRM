import { CustomersTable } from "@/components/customers-table";
import { getCustomers } from "@/lib/queries";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Client profiles and lead management
        </p>
      </div>
      <CustomersTable customers={customers} />
    </div>
  );
}
