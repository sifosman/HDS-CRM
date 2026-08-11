"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Loader2 } from "lucide-react";
import { sendBroadcastCampaign } from "@/app/(authenticated)/broadcasts/actions";
import { BroadcastRecipientsTable } from "@/components/broadcasts-table";

export { BroadcastRecipientsTable };

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleSend() {
    startTransition(async () => {
      const res = await sendBroadcastCampaign(campaignId);
      setFeedback({ ok: res.ok, msg: res.ok ? `Sent ${res.count} messages` : res.error });
      if (res.ok) {
        setTimeout(() => {
          setOpen(false);
          setFeedback(null);
        }, 2000);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" />
        Send Now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Send broadcast now?</DialogTitle>
            <DialogDescription>
              This will send WhatsApp template messages to all pending recipients.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {feedback && (
            <p
              className={`text-sm ${
                feedback.ok ? "text-success" : "text-destructive"
              }`}
            >
              {feedback.msg}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
