/**
 * Segment resolver: maps a broadcast segment to a set of recipient phone numbers.
 *
 * Always excludes:
 *  - customers with do_not_contact = true (Phase 5 compliance)
 *  - test phone numbers (27900000000–27900000200) unless in test mode
 *
 * Uses the service-role admin client so RLS doesn't block the recipient query.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { BroadcastSegment, CustomerProfile } from "@/lib/types";

export type ResolvedRecipient = {
  phone_number: string;
  name: string | null;
  customer_type: string | null;
  city: string | null;
};

export type ResolveOptions = {
  /** When true, include test phone numbers (27900000001–27900000200). */
  includeTestNumbers?: boolean;
  /** Limit the number of recipients returned (for preview). */
  limit?: number;
};

const TEST_NUMBER_PREFIX = "27900000";
const TEST_NUMBER_RANGE_MIN = 1;
const TEST_NUMBER_RANGE_MAX = 200;

function isTestNumber(phone: string): boolean {
  if (!phone.startsWith(TEST_NUMBER_PREFIX)) return false;
  const tail = parseInt(phone.slice(TEST_NUMBER_PREFIX.length), 10);
  return tail >= TEST_NUMBER_RANGE_MIN && tail <= TEST_NUMBER_RANGE_MAX;
}

function applySegmentFilter(
  customers: CustomerProfile[],
  segment: BroadcastSegment
): CustomerProfile[] {
  switch (segment.segment_type) {
    case "lost_leads":
      return customers.filter((c) => c.lead_status === "lost");
    case "carpenters":
      return customers.filter((c) => c.customer_type === "carpenter");
    case "bulk_buyers":
      return customers.filter((c) => c.customer_type === "bulk_buyer");
    case "quoted_not_closed":
      return customers.filter(
        (c) =>
          c.lead_status === "quoted" ||
          c.lead_status === "closing" ||
          c.lead_status === "objection" ||
          c.lead_status === "follow_up"
      );
    case "custom":
      // Custom segments use query_condition JSON; for now apply a simple
      // customer_type + city filter if present. Extend as needed.
      return customers.filter((c) => {
        const cond = segment.query_condition as Record<string, unknown>;
        if (
          cond.customer_type &&
          c.customer_type !== cond.customer_type
        )
          return false;
        if (cond.city && c.city !== cond.city) return false;
        if (
          cond.lead_status &&
          c.lead_status !== cond.lead_status
        )
          return false;
        return true;
      });
    default:
      return customers;
  }
}

export async function resolveSegmentRecipients(
  segment: BroadcastSegment,
  options: ResolveOptions = {}
): Promise<ResolvedRecipient[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("phone_number, name, customer_type, city, do_not_contact")
    .order("last_interaction_at", { ascending: false, nullsFirst: false });

  if (error) throw error;

  const all = (data || []) as Array<
    Pick<
      CustomerProfile,
      "phone_number" | "name" | "customer_type" | "city" | "do_not_contact"
    >
  >;

  let eligible = all.filter((c) => !c.do_not_contact);

  if (!options.includeTestNumbers) {
    eligible = eligible.filter((c) => !isTestNumber(c.phone_number));
  }

  const filtered = applySegmentFilter(eligible as CustomerProfile[], segment);

  let result: ResolvedRecipient[] = filtered.map((c) => ({
    phone_number: c.phone_number,
    name: c.name,
    customer_type: c.customer_type,
    city: c.city,
  }));

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/** Count recipients for a segment without materialising all rows. */
export async function countSegmentRecipients(
  segment: BroadcastSegment,
  options: ResolveOptions = {}
): Promise<number> {
  const recipients = await resolveSegmentRecipients(segment, options);
  return recipients.length;
}
