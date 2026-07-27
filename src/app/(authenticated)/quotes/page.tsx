import { QuotesTable } from "@/components/quotes-table";
import { getAllQuotes } from "@/lib/queries";

export default async function QuotesPage() {
  const quotes = await getAllQuotes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Quotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All quotes with totals, status, and PDF links
        </p>
      </div>
      <QuotesTable quotes={quotes} />
    </div>
  );
}
