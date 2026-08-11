import { SegmentsManager } from "@/components/segments-manager";
import { getSegments, getCustomers, applySegmentFilter } from "@/lib/queries";
import type { Segment } from "@/lib/types";

export default async function SegmentsPage() {
  const [segments, customers] = await Promise.all([
    getSegments(),
    getCustomers(),
  ]);

  // Compute live matched count for each segment
  const segmentsWithCounts = segments.map((seg) => ({
    ...seg,
    matchedCount: applySegmentFilter(customers, seg.filter_rules).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Lead Segments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Classify and target customer groups for broadcasts and follow-ups
        </p>
      </div>
      <SegmentsManager segments={segmentsWithCounts} customers={customers} />
    </div>
  );
}
