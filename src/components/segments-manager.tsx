"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CUSTOMER_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import type { CustomerProfile, Segment, SegmentFilterRules } from "@/lib/types";

type SegmentWithCount = Segment & { matchedCount: number };

export function SegmentsManager({
  segments,
  customers,
}: {
  segments: SegmentWithCount[];
  customers: CustomerProfile[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [quotedWithinDays, setQuotedWithinDays] = useState("");
  const [interactedWithinDays, setInteractedWithinDays] = useState("");
  const [minQuotes, setMinQuotes] = useState("");
  const [saving, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState("");

  // Live preview count
  const previewCount = useMemo(() => {
    const rules: SegmentFilterRules = {};
    if (selectedTypes.length > 0) rules.customer_type = selectedTypes;
    if (selectedStatuses.length > 0) rules.lead_status = selectedStatuses;
    if (city.trim()) rules.city = city.trim();
    if (quotedWithinDays) rules.quoted_within_days = Number(quotedWithinDays);
    if (interactedWithinDays)
      rules.interacted_within_days = Number(interactedWithinDays);
    if (minQuotes) rules.min_total_quotes = Number(minQuotes);

    return customers.filter((c) => {
      if (rules.customer_type && rules.customer_type.length > 0) {
        if (!rules.customer_type.includes(c.customer_type || "unknown"))
          return false;
      }
      if (rules.lead_status && rules.lead_status.length > 0) {
        if (!rules.lead_status.includes(c.lead_status || "new")) return false;
      }
      if (rules.city) {
        if (!c.city || !c.city.toLowerCase().includes(rules.city.toLowerCase()))
          return false;
      }
      if (rules.quoted_within_days !== undefined) {
        if (!c.last_quote_date) return false;
        const cutoff =
          Date.now() - rules.quoted_within_days * 24 * 60 * 60 * 1000;
        if (new Date(c.last_quote_date).getTime() < cutoff) return false;
      }
      if (rules.interacted_within_days !== undefined) {
        if (!c.last_interaction_at) return false;
        const cutoff =
          Date.now() - rules.interacted_within_days * 24 * 60 * 60 * 1000;
        if (new Date(c.last_interaction_at).getTime() < cutoff) return false;
      }
      if (rules.min_total_quotes !== undefined) {
        if ((c.total_quotes || 0) < rules.min_total_quotes) return false;
      }
      return true;
    }).length;
  }, [
    customers,
    selectedTypes,
    selectedStatuses,
    city,
    quotedWithinDays,
    interactedWithinDays,
    minQuotes,
  ]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const rules: SegmentFilterRules = {};
    if (selectedTypes.length > 0) rules.customer_type = selectedTypes;
    if (selectedStatuses.length > 0) rules.lead_status = selectedStatuses;
    if (city.trim()) rules.city = city.trim();
    if (quotedWithinDays) rules.quoted_within_days = Number(quotedWithinDays);
    if (interactedWithinDays)
      rules.interacted_within_days = Number(interactedWithinDays);
    if (minQuotes) rules.min_total_quotes = Number(minQuotes);

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("segments").insert({
        name: name.trim(),
        description: description.trim() || null,
        filter_rules: rules,
        recipient_count: previewCount,
      });

      if (error) {
        setSavedMsg(`Error: ${error.message}`);
      } else {
        setSavedMsg("Segment saved!");
        // Reset form
        setName("");
        setDescription("");
        setSelectedTypes([]);
        setSelectedStatuses([]);
        setCity("");
        setQuotedWithinDays("");
        setInteractedWithinDays("");
        setMinQuotes("");
        setTimeout(() => {
          setSavedMsg("");
          setOpen(false);
        }, 1500);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("segments").delete().eq("id", id);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {segments.length} saved segment{segments.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Segment</Button>} />
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Saved Segment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seg-name">Segment Name</Label>
                <Input
                  id="seg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Carpenters – Gauteng – Quoted in Last 30 Days"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seg-desc">Description (optional)</Label>
                <Textarea
                  id="seg-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this segment for?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Customer Type</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CUSTOMER_TYPE_LABELS).map(([key, label]) => (
                    <Badge
                      key={key}
                      variant={selectedTypes.includes(key) ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleType(key)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lead Status</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(LEAD_STATUS_LABELS).map(([key, label]) => (
                    <Badge
                      key={key}
                      variant={selectedStatuses.includes(key) ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(key)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seg-city">City (contains)</Label>
                  <Input
                    id="seg-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Gauteng"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seg-quoted">Quoted within (days)</Label>
                  <Input
                    id="seg-quoted"
                    type="number"
                    value={quotedWithinDays}
                    onChange={(e) => setQuotedWithinDays(e.target.value)}
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seg-interacted">Interacted within (days)</Label>
                  <Input
                    id="seg-interacted"
                    type="number"
                    value={interactedWithinDays}
                    onChange={(e) => setInteractedWithinDays(e.target.value)}
                    placeholder="e.g. 7"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seg-min-quotes">Min Quotes</Label>
                  <Input
                    id="seg-min-quotes"
                    type="number"
                    value={minQuotes}
                    onChange={(e) => setMinQuotes(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {previewCount} customer{previewCount !== 1 ? "s" : ""} match
                </span>
              </div>
            </div>

            <DialogFooter>
              {savedMsg && (
                <span className="text-sm text-muted-foreground mr-auto">
                  {savedMsg}
                </span>
              )}
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Segment"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No segments yet. Create one to target specific customer groups.
                  </TableCell>
                </TableRow>
              )}
              {segments.map((seg) => (
                <TableRow key={seg.id}>
                  <TableCell className="font-medium">{seg.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {seg.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{seg.matchedCount}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(seg.created_at).toLocaleDateString("en-ZA")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(seg.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
