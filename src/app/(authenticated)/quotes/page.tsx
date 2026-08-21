import { QuotesTable } from "@/components/quotes-table";
import { getChatbotQuotes, getHistoricalQuotes } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function QuotesPage() {
  const [chatbotQuotes, historicalQuotes] = await Promise.all([
    getChatbotQuotes(),
    getHistoricalQuotes(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold">Quotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chatbot-generated quotes shown first · Historical quotes below
        </p>
      </div>

      {/* Chatbot Quotes (primary) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-heading font-semibold">New Chatbot Quotes</h2>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            {chatbotQuotes.length} quotes
          </Badge>
        </div>
        {chatbotQuotes.length > 0 ? (
          <QuotesTable quotes={chatbotQuotes} />
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No chatbot quotes yet. They will appear here once the chatbot generates them.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Historical Quotes (pre-chatbot) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-heading font-semibold">Historical Quotes (Pre-Chatbot)</h2>
          <Badge variant="outline">
            {historicalQuotes.length} quotes
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Legacy quotes from the previous system — retained for comparison and reference.
        </p>
        <QuotesTable quotes={historicalQuotes} />
      </div>
    </div>
  );
}
