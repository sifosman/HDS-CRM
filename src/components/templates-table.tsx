"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Send,
  Trash2,
  Loader2,
  Eye,
} from "lucide-react";
import type { WaTemplate } from "@/lib/types";
import {
  WA_TEMPLATE_STATUS_LABELS,
  WA_TEMPLATE_STATUS_COLORS,
  WA_TEMPLATE_CATEGORY_LABELS,
  formatDate,
  formatDateTime,
} from "@/lib/constants";
import {
  submitTemplateToMeta,
  syncTemplateStatus,
  deleteTemplate,
} from "@/app/(authenticated)/templates/actions";

type TemplatesTableProps = {
  templates: WaTemplate[];
  metaConfigured: boolean;
};

export function TemplatesTable({ templates, metaConfigured }: TemplatesTableProps) {
  const [pending, startTransition] = useTransition();
  const [viewTemplate, setViewTemplate] = useState<WaTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleSubmit(id: string) {
    startTransition(async () => {
      const res = await submitTemplateToMeta(id);
      flash(res.ok, res.ok ? "Submitted to Meta" : res.error);
    });
  }

  function handleSync(id: string) {
    startTransition(async () => {
      const res = await syncTemplateStatus(id);
      flash(res.ok, res.ok ? "Status synced" : res.error);
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const res = await deleteTemplate(deleteId, false);
      setDeleteId(null);
      flash(res.ok, res.ok ? "Template deleted" : res.error);
    });
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-md p-3 text-sm ${
            feedback.ok
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No templates yet. Click &quot;New Template&quot; to create one.
                  </TableCell>
                </TableRow>
              )}
              {templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium font-mono text-sm">
                    {tpl.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {WA_TEMPLATE_CATEGORY_LABELS[tpl.category] || tpl.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tpl.language}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={WA_TEMPLATE_STATUS_COLORS[tpl.status]}
                      variant="secondary"
                    >
                      {WA_TEMPLATE_STATUS_LABELS[tpl.status] || tpl.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{tpl.variable_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tpl.last_synced_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setViewTemplate(tpl)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(tpl.status === "draft" || tpl.status === "pending") &&
                        tpl.meta_template_id === null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubmit(tpl.id)}
                            disabled={pending}
                            title="Submit to Meta"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Submit
                          </Button>
                        )}
                      {tpl.meta_template_id !== null && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleSync(tpl.id)}
                          disabled={pending}
                          title="Sync status"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(tpl.id)}
                        disabled={pending}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!metaConfigured && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Meta is not configured. Templates can be saved as drafts but cannot be
          submitted to Meta until WHATSAPP_ACCESS_TOKEN, WHATSAPP_WABA_ID, and
          WHATSAPP_PHONE_NUMBER_ID are set.
        </p>
      )}

      {/* View dialog */}
      <Dialog open={!!viewTemplate} onOpenChange={(o) => !o && setViewTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">{viewTemplate?.name}</DialogTitle>
            <DialogDescription>
              {viewTemplate &&
                `${WA_TEMPLATE_CATEGORY_LABELS[viewTemplate.category]} • ${viewTemplate.language}`}
            </DialogDescription>
          </DialogHeader>
          {viewTemplate && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className={WA_TEMPLATE_STATUS_COLORS[viewTemplate.status]} variant="secondary">
                  {WA_TEMPLATE_STATUS_LABELS[viewTemplate.status]}
                </Badge>
                {viewTemplate.meta_template_id && (
                  <Badge variant="outline">
                    Meta ID: {viewTemplate.meta_template_id}
                  </Badge>
                )}
              </div>
              {viewTemplate.rejection_reason && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Rejection reason:</p>
                  <p>{viewTemplate.rejection_reason}</p>
                </div>
              )}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                {viewTemplate.header_text && (
                  <p className="font-semibold text-sm">{viewTemplate.header_text}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{viewTemplate.body_text}</p>
                {viewTemplate.footer && (
                  <p className="text-xs text-muted-foreground">{viewTemplate.footer}</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {formatDateTime(viewTemplate.created_at)}</p>
                <p>Variables: {viewTemplate.variable_count}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              This removes the template from the CRM. The template will remain in
              Meta unless deleted separately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
