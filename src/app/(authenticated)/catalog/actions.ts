"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle the `discontinued` flag on a product.
 * Discontinued products are filtered out of the WhatsApp bot's
 * show_products carousel so customers no longer see them.
 */
export async function toggleDiscontinued(
  wooId: number,
  discontinued: boolean
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("products")
      .update({ discontinued, updated_at: new Date().toISOString() })
      .eq("woo_id", wooId);
    if (error) throw new Error(error.message);
    revalidatePath("/catalog");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update product",
    };
  }
}
