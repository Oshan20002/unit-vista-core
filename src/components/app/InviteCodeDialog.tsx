import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InviteCodeDialog({
  invite,
  onClose,
  kind,
}: {
  invite: { name: string; email: string; code: string } | null;
  onClose: () => void;
  kind: "tenant" | "landlord" | "technician" | "vendor";
}) {
  const copy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    toast.success("Code copied.");
  };
  return (
    <Dialog open={Boolean(invite)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-accent" /> One-time registration code
          </DialogTitle>
          <DialogDescription>
            Send this code to {invite?.name} ({invite?.email}). The {kind} registers on the Register
            tab with their email and this code, then sets a password.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-surface py-6 text-center font-mono text-3xl font-semibold tracking-[0.4em]">
          {invite?.code}
        </div>
        <p className="text-xs text-muted-foreground">
          The code is also saved and shown in the list, until it is used.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy className="size-4" /> Copy code
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
