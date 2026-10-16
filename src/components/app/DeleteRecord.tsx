import { Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAY = 86_400_000;

/** Row style for records marked deleted: red with a line through. */
export const deletedRowClass = (row: { deleted_at?: string | undefined }) =>
  row.deleted_at ? "line-through decoration-destructive text-destructive [&_*]:text-destructive bg-destructive/5" : undefined;

export function daysUntilPurge(deletedAt: string) {
  return Math.max(0, Math.ceil((new Date(deletedAt).getTime() + 7 * DAY - Date.now()) / DAY));
}

/** Shows "Deleted · N days left" for deleted rows. */
export function DeletedLabel({ deletedAt }: { deletedAt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive no-underline ring-1 ring-inset ring-destructive/20">
      Deleted · {daysUntilPurge(deletedAt)}d left
    </span>
  );
}

export function DeleteRecordButton({
  label,
  name,
  warning,
  onConfirm,
}: {
  label: string;
  name: string;
  warning?: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      toast.success(`${name} marked as deleted. It will be removed permanently in 7 days.`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        title={`Delete ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          setTyped("");
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {label}?</DialogTitle>
            <DialogDescription>
              <strong>{name}</strong> will be marked as deleted now and permanently removed after 7 days.
              {warning ? ` ${warning}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-mono font-semibold">delete</span> to confirm
            </Label>
            <Input id="confirm-delete" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={typed.trim().toLowerCase() !== "delete" || busy} onClick={confirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
