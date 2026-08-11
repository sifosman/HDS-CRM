"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BROADCAST_SEGMENT_LABELS,
} from "@/lib/constants";
import type { WaTemplate, BroadcastSegment } from "@/lib/types";
import {
  createBroadcastCampaign,
  previewSegmentRecipients,
} from "@/app/(authenticated)/broadcasts/actions";

type BroadcastFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: WaTemplate[];
  segments: BroadcastSegment[];
};

type PreviewRecipient = { phone_number: string; name: string | null };

export function BroadcastForm({
  open,
  onOpenChange,
  templates,
  segments,
}: BroadcastFormProps) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<PreviewRecipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const approvedTemplates = templates.filter((t) => t.status === "approved");

  function reset() {
    setName("");
    setTemplateId("");
    setSegmentId("");
    setTestMode(true);
    setScheduledAt("");
    setPreview(null);
    setError(null);
    setResult(null);
  }

  function handleClose(open: boolean) {
    onOpenChange(open);
    if (!open) setTimeout(reset, 200);
  }

  function handlePreview() {
    setError(null);
    setResult(null);
    if (!segmentId) {
      setError("Select a segment first");
      return;
    }
    startTransition(async () => {
      const res = await previewSegmentRecipients(segmentId, testMode);
      if (res.ok) {
        setPreview(res.recipients);
      } else {
        setError(res.error);
      }
    });
  }

  function handleCreate() {
    setError(null);
    setResult(null);
    if (!name.trim() || !templateId || !segmentId) {
      setError("Name, template, and segment are required");
      return;
    }
    startTransition(async () => {
      const res = await createBroadcastCampaign({
        name: name.trim(),
        templateId,
        segmentId,
        scheduledAt: scheduledAt || null,
        testMode,
      });
      if (res.ok) {
        setResult(`Campaign created with ${res.count} recipients`);
        setTimeout(() => handleClose(false), 1500);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Broadcast Campaign</DialogTitle>
          <DialogDescription>
            Select an approved template and a segment to target.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="bc-name">Campaign Name</Label>
            <Input
              id="bc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Promo - Carpenters"
            />
          </div>

          <div className="grid gap-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select approved template" />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.length === 0 && (
                  <SelectItem value="_none" disabled>
                    No approved templates
                  </SelectItem>
                )}
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {approvedTemplates.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No approved templates available. Create and get a template
                approved on the Templates page first.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Segment</Label>
            <Select value={segmentId} onValueChange={(v) => setSegmentId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                {segments.length === 0 && (
                  <SelectItem value="_none" disabled>
                    No segments defined
                  </SelectItem>
                )}
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({BROADCAST_SEGMENT_LABELS[s.segment_type] || s.segment_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {segments.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No segments yet. Segments are managed in Supabase
                (broadcast_segments table).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bc-schedule">Schedule (optional)</Label>
              <Input
                id="bc-schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to save as draft.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select
                value={testMode ? "test" : "live"}
                onValueChange={(v) => setTestMode(v === "test")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test (test numbers only)</SelectItem>
                  <SelectItem value="live">Live (all eligible)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {testMode
                  ? "Only sends to 27900000001–27900000200"
                  : "Sends to all real customers in segment"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={pending || !segmentId}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Preview Recipients
            </Button>
            {preview && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {preview.length} shown (max 50)
              </span>
            )}
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/50 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Recipient Preview
              </p>
              <div className="space-y-1">
                {preview.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No eligible recipients in this segment.
                  </p>
                )}
                {preview.map((r) => (
                  <div key={r.phone_number} className="text-xs flex justify-between">
                    <span className="font-mono">{r.phone_number}</span>
                    <span className="text-muted-foreground">{r.name || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && <p className="text-sm text-success">{result}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BroadcastFormTrigger({
  templates,
  segments,
}: {
  templates: WaTemplate[];
  segments: BroadcastSegment[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Broadcast
      </Button>
      <BroadcastForm
        open={open}
        onOpenChange={setOpen}
        templates={templates}
        segments={segments}
      />
    </>
  );
}
