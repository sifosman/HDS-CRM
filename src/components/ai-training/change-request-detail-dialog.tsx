"use client";

import {
  AlertTriangle,
  Mail,
  Clock,
  RefreshCw,
  Target,
  History,
  Lightbulb,
  ListChecks,
  Wrench,
  Quote,
  Tag,
  Calendar,
  Cpu,
  MinusCircle,
  PlusCircle,
  Edit3,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  AdvisorChangeRequest,
  AdvisorPricingChange,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared color constants for change requests
// ---------------------------------------------------------------------------

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  implemented: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
};

export const NOTIFICATION_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  in_review: "bg-blue-500",
  approved: "bg-green-500",
  implemented: "bg-purple-500",
  rejected: "bg-red-500",
};

export const PRIORITY_BORDER_COLORS: Record<string, string> = {
  low: "border-l-blue-400",
  medium: "border-l-yellow-400",
  high: "border-l-orange-400",
  critical: "border-l-red-500",
};

// ---------------------------------------------------------------------------
// Change request detail dialog (shared by training workspace + customer chat)
// ---------------------------------------------------------------------------

export function ChangeRequestDetailDialog({
  request,
  ownerName,
  onClose,
  onStatusChange,
  onRetry,
}: {
  request: AdvisorChangeRequest;
  ownerName?: string;
  onClose: () => void;
  onStatusChange: (status: AdvisorChangeRequest["status"]) => void;
  onRetry: () => void;
}) {
  const pricingChanges = (request.pricing_changes ?? []) as AdvisorPricingChange[];
  const hasPricing = pricingChanges.length > 0;
  const addCount = pricingChanges.filter((p) => p.action === "add").length;
  const updateCount = pricingChanges.filter((p) => p.action === "update").length;
  const removeCount = pricingChanges.filter((p) => p.action === "remove").length;

  const createdDate = new Date(request.created_at);
  const notifiedDate = request.notified_at ? new Date(request.notified_at) : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden p-0 gap-0">
        {/* Header band */}
        <div className="px-6 py-5 border-b bg-gradient-to-br from-muted/50 to-background">
          <DialogHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-xl font-heading font-bold leading-tight pr-8">
                {request.title}
              </DialogTitle>
            </div>
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${PRIORITY_COLORS[request.priority] ?? ""} capitalize gap-1`}>
                <AlertTriangle className="h-3 w-3" />
                {request.priority} priority
              </Badge>
              <Badge className={`${STATUS_COLORS[request.status] ?? ""} capitalize gap-1`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[request.status] ?? "bg-gray-400"}`} />
                {request.status.replace("_", " ")}
              </Badge>
              <Badge className={`${NOTIFICATION_COLORS[request.notification_status] ?? ""} capitalize gap-1`}>
                <Mail className="h-3 w-3" />
                {request.notification_status}
              </Badge>
              {request.affected_areas.map((area) => (
                <Badge key={area} variant="outline" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {area}
                </Badge>
              ))}
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5" style={{ maxHeight: "calc(90vh - 180px)" }}>
          {/* Requested + Current behavior side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {request.requested_behavior && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-primary">Requested Change</Label>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.requested_behavior}</p>
              </div>
            )}
            {request.current_behavior && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Behavior</Label>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{request.current_behavior}</p>
              </div>
            )}
          </div>

          {/* Rationale + Risks side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {request.rationale && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-amber-600">Rationale</Label>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.rationale}</p>
              </div>
            )}
            {request.risks && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-red-600">Risks</Label>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.risks}</p>
              </div>
            )}
          </div>

          {/* Acceptance criteria + Implementation notes side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {request.acceptance_criteria && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-4 w-4 text-green-600" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-green-600">Acceptance Criteria</Label>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.acceptance_criteria}</p>
              </div>
            )}
            {request.implementation_notes && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  <Label className="text-xs font-semibold uppercase tracking-wide text-blue-600">Implementation Notes</Label>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.implementation_notes}</p>
              </div>
            )}
          </div>

          {/* Examples */}
          {request.examples && request.examples.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Quote className="h-4 w-4 text-purple-500" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-purple-600">Examples</Label>
              </div>
              <div className="space-y-3">
                {request.examples.map((ex, i) => (
                  <div key={i} className="rounded-md border-l-2 border-l-purple-300 bg-muted/30 p-3 text-sm">
                    {ex.customerMessage && (
                      <p className="flex gap-2">
                        <span className="font-medium text-muted-foreground shrink-0">Customer:</span>
                        <span className="italic">&ldquo;{ex.customerMessage}&rdquo;</span>
                      </p>
                    )}
                    {ex.desiredReply && (
                      <p className="mt-2 flex gap-2">
                        <span className="font-medium text-muted-foreground shrink-0">Desired reply:</span>
                        <span>{ex.desiredReply}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing changes table */}
          {hasPricing && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Tag className="h-4 w-4 text-primary" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-primary">Pricing Changes</Label>
                <div className="flex items-center gap-1.5 ml-auto">
                  {addCount > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-green-600 border-green-200">
                      <PlusCircle className="h-3 w-3" />
                      {addCount} new
                    </Badge>
                  )}
                  {updateCount > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-200">
                      <Edit3 className="h-3 w-3" />
                      {updateCount} changed
                    </Badge>
                  )}
                  {removeCount > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-red-600 border-red-200">
                      <MinusCircle className="h-3 w-3" />
                      {removeCount} removed
                    </Badge>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      <th className="text-left p-2.5 font-semibold">Code</th>
                      <th className="text-left p-2.5 font-semibold">Description</th>
                      <th className="text-left p-2.5 font-semibold">Action</th>
                      <th className="text-right p-2.5 font-semibold">Old Price</th>
                      <th className="text-right p-2.5 font-semibold">New Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingChanges.map((p, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 font-mono font-medium">{p.code}</td>
                        <td className="p-2.5 truncate max-w-[260px]" title={p.description}>{p.description ?? "—"}</td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center gap-1 font-medium ${
                            p.action === "add" ? "text-green-600" :
                            p.action === "remove" ? "text-red-600" :
                            "text-blue-600"
                          }`}>
                            {p.action === "add" && <PlusCircle className="h-3 w-3" />}
                            {p.action === "remove" && <MinusCircle className="h-3 w-3" />}
                            {p.action === "update" && <Edit3 className="h-3 w-3" />}
                            {p.action}
                          </span>
                        </td>
                        <td className="p-2.5 text-right text-muted-foreground">
                          {p.oldPrice != null ? `R${p.oldPrice}` : "—"}
                        </td>
                        <td className="p-2.5 text-right font-semibold">
                          {p.newPrice != null ? `R${p.newPrice}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Metadata footer */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground border-t pt-4">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Created {createdDate.toLocaleString()}
            </span>
            {ownerName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {ownerName}
              </span>
            )}
            {request.model_id && (
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                {request.model_id}
              </span>
            )}
            {notifiedDate && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Notified {notifiedDate.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          {request.notification_status === "failed" && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry email
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={request.status}
              onValueChange={(v) => onStatusChange(v as AdvisorChangeRequest["status"])}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
