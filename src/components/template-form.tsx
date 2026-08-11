"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Send, Save } from "lucide-react";
import {
  WA_TEMPLATE_LANGUAGES,
  WA_TEMPLATE_CATEGORY_LABELS,
} from "@/lib/constants";
import { saveTemplateDraft, submitTemplateToMeta } from "@/app/(authenticated)/templates/actions";

type TemplateFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metaConfigured: boolean;
};

export function TemplateForm({
  open,
  onOpenChange,
  metaConfigured,
}: TemplateFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("marketing");
  const [language, setLanguage] = useState("en_ZA");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footer, setFooter] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setCategory("marketing");
    setLanguage("en_ZA");
    setHeaderText("");
    setBodyText("");
    setFooter("");
    setResult(null);
    setError(null);
  }

  function handleClose(open: boolean) {
    onOpenChange(open);
    if (!open) {
      setTimeout(reset, 200);
    }
  }

  function handleSaveDraft() {
    setError(null);
    setResult(null);
    if (!name.trim() || !bodyText.trim()) {
      setError("Name and body text are required");
      return;
    }
    startTransition(async () => {
      const res = await saveTemplateDraft({
        name: name.trim().toLowerCase().replace(/\s+/g, "_"),
        category: category as "marketing" | "utility" | "authentication",
        language,
        headerType: headerText ? "TEXT" : null,
        headerText: headerText || null,
        bodyText,
        footer: footer || null,
        buttons: [],
      });
      if (res.ok) {
        setResult("Template draft saved");
        setTimeout(() => handleClose(false), 1200);
      } else {
        setError(res.error);
      }
    });
  }

  function handleSubmitToMeta() {
    setError(null);
    setResult(null);
    if (!name.trim() || !bodyText.trim()) {
      setError("Name and body text are required");
      return;
    }
    startTransition(async () => {
      // Save draft first, then submit
      const saveRes = await saveTemplateDraft({
        name: name.trim().toLowerCase().replace(/\s+/g, "_"),
        category: category as "marketing" | "utility" | "authentication",
        language,
        headerType: headerText ? "TEXT" : null,
        headerText: headerText || null,
        bodyText,
        footer: footer || null,
        buttons: [],
      });
      if (!saveRes.ok) {
        setError(saveRes.error);
        return;
      }
      const savedId = saveRes.id;
      if (!savedId) {
        setError("Template saved but no ID returned");
        return;
      }
      const submitRes = await submitTemplateToMeta(savedId);
      if (submitRes.ok) {
        setResult("Template submitted to Meta for approval");
        setTimeout(() => handleClose(false), 1500);
      } else {
        setError(submitRes.error);
      }
    });
  }

  const preview = bodyText
    .replace(/\{\{1\}\}/g, "[Name]")
    .replace(/\{\{2\}\}/g, "[Value]");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New WhatsApp Template</DialogTitle>
          <DialogDescription>
            Create a message template. Variables use the{" "}
            <code className="text-xs">{"{{1}}"}</code>,{" "}
            <code className="text-xs">{"{{2}}"}</code> format.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="tpl-name">Template Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. spring_promo_2026"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase, underscores only. Must be unique.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "marketing")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WA_TEMPLATE_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v ?? "en_ZA")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {WA_TEMPLATE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tpl-header">Header (optional, text only)</Label>
            <Input
              id="tpl-header"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="e.g. Spring Special Offer"
              maxLength={60}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tpl-body">Body Text</Label>
            <Textarea
              id="tpl-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Hi {{1}}, our {{2}} is now available at a special price. Reply to order."
              rows={5}
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground">
              {bodyText.length}/1024 characters
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tpl-footer">Footer (optional)</Label>
            <Input
              id="tpl-footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="e.g. Reply STOP to opt out"
              maxLength={60}
            />
          </div>

          {bodyText && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Preview
              </p>
              {headerText && (
                <p className="font-semibold text-sm">{headerText}</p>
              )}
              <p className="text-sm whitespace-pre-wrap">{preview}</p>
              {footer && (
                <p className="text-xs text-muted-foreground mt-1">{footer}</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {result && (
            <p className="text-sm text-success">{result}</p>
          )}
          {!metaConfigured && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Meta is not configured — this will save as a draft and mark as
              pending. Set WHATSAPP_WABA_ID to submit to Meta.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button onClick={handleSubmitToMeta} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit to Meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Client trigger button that opens the TemplateForm dialog.
 * Used by the server-rendered /templates page.
 */
export function TemplateFormTrigger({
  metaConfigured,
}: {
  metaConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Template
      </Button>
      <TemplateForm
        open={open}
        onOpenChange={setOpen}
        metaConfigured={metaConfigured}
      />
    </>
  );
}
