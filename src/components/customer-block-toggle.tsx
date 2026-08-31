"use client";

import { useState, useTransition } from "react";
import { Ban, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

export function CustomerBlockToggle({
  phone,
  initialBlocked,
  initialReason,
}: {
  phone: string;
  initialBlocked: boolean;
  initialReason: string | null;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [reason, setReason] = useState(initialReason || "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, startTransition] = useTransition();

  const handleBlock = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("customer_profiles")
        .update({
          is_blocked: true,
          blocked_reason: reason.trim() || null,
          blocked_at: new Date().toISOString(),
        })
        .eq("phone_number", phone);
      if (!error) {
        setBlocked(true);
        setDialogOpen(false);
      }
    });
  };

  const handleUnblock = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("customer_profiles")
        .update({
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
        })
        .eq("phone_number", phone);
      if (!error) {
        setBlocked(false);
        setReason("");
      }
    });
  };

  if (blocked) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1">
          <Ban className="h-3 w-3" />
          BLOCKED
        </Badge>
        {initialReason && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {initialReason}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleUnblock}
          disabled={saving}
          className="h-7"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Unblock
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-7 text-destructive">
            <Ban className="h-3 w-3" />
            Block Number
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block this WhatsApp number?</DialogTitle>
          <DialogDescription>
            William (the chatbot) will stop replying to this number. Incoming
            messages will still be logged silently. You can unblock at any time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Reason <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            placeholder="e.g. spam, abuse, test number"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleBlock}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            Block Number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
