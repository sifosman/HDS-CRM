"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SalesNotesEditor({
  phone,
  initialNotes,
}: {
  phone: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("customer_profiles")
        .update({ sales_notes: notes })
        .eq("phone_number", phone);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add sales notes..."
        rows={5}
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save Notes"}
        </Button>
        {saved && (
          <span className="text-sm text-success">Saved!</span>
        )}
      </div>
    </div>
  );
}
