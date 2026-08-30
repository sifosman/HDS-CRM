"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Update the price of a single product in the hds_prices_william table.
 *
 * Only `price` is editable from the dashboard — the product identity fields
 * (description, code, material_type) that William uses to match customer
 * queries are intentionally locked. Uses the service-role admin client to
 * bypass RLS (the table has permissive SELECT policies but no UPDATE policy).
 *
 * Edits take effect immediately in William's quotes because the hdsproject1
 * server reads this table live on every request (priceList=william).
 */
export async function updateWilliamPrice(
  id: number,
  price: number
): Promise<ActionResult> {
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Price must be a positive number" };
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("hds_prices_william")
      .update({ price })
      .eq("ID", id);
    if (error) throw new Error(error.message);
    revalidatePath("/william-pricing");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update price",
    };
  }
}
