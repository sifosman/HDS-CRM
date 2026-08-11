"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_COLORS,
  CLASSIFICATION_SOURCE_LABELS,
} from "@/lib/constants";

export function CustomerTypeEditor({
  phone,
  initialType,
  initialSource,
}: {
  phone: string;
  initialType: string | null;
  initialSource: string | null;
}) {
  const [type, setType] = useState(initialType || "unknown");
  const [source, setSource] = useState(initialSource || "unknown");
  const [saving, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleChange = (value: string | null) => {
    const newType = value || "unknown";
    setType(newType);
    startTransition(async () => {
      const supabase = createClient();
      await supabase
        .from("customer_profiles")
        .update({
          customer_type: newType,
          classification_source: "manual",
          classified_at: new Date().toISOString(),
        })
        .eq("phone_number", phone);
      setSource("manual");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="space-y-2">
      <Select value={type} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CUSTOMER_TYPE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Badge className={CUSTOMER_TYPE_COLORS[type] || CUSTOMER_TYPE_COLORS.unknown}>
          {CUSTOMER_TYPE_LABELS[type] || "Unknown"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Source: {CLASSIFICATION_SOURCE_LABELS[source] || "—"}
          {saving && " (saving...)"}
          {saved && " ✓ saved"}
        </span>
      </div>
    </div>
  );
}
