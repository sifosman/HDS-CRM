"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QuotesTable } from "@/components/quotes-table";
import { AcceptedQuotesTable } from "@/components/accepted-quotes-table";
import type { Quote, QuoteAcceptanceMap } from "@/lib/types";

export function QuotesTabs({
  quotes,
  acceptance,
  acceptedCount,
}: {
  quotes: Quote[];
  acceptance: QuoteAcceptanceMap;
  acceptedCount: number;
}) {
  return (
    <Tabs defaultValue="all">
      <TabsList>
        <TabsTrigger value="all">
          All Quotes
          <Badge
            variant="secondary"
            className="ml-1.5 h-5 text-xs"
          >
            {quotes.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="accepted">
          Accepted Quotes
          <Badge
            variant="secondary"
            className="ml-1.5 h-5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
          >
            {acceptedCount}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all">
        <QuotesTable quotes={quotes} acceptance={acceptance} />
      </TabsContent>

      <TabsContent value="accepted">
        <AcceptedQuotesTable quotes={quotes} acceptance={acceptance} />
      </TabsContent>
    </Tabs>
  );
}
