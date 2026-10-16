import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/app/PageHeader";
import { useApp } from "@/lib/app-store";

const blank = { bank_name: "", account_number: "", branch: "", account_name: "" };
const FIELDS = [
  ["bank_name", "Bank name"],
  ["account_number", "Account number"],
  ["branch", "Branch"],
  ["account_name", "Account owner name"],
] as const;

/** Property management company bank accounts — shown to tenants when they pay rent. */
export function CompanyBanksCard() {
  const { companyBanks, addCompanyBank, deleteCompanyBank } = useApp();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!form.bank_name.trim() || !form.account_number.trim()) {
      toast.error("Enter at least the bank name and account number.");
      return;
    }
    setBusy(true);
    try {
      await addCompanyBank({
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        branch: form.branch.trim(),
        account_name: form.account_name.trim(),
      });
      setForm(blank);
      toast.success("Bank account added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the bank account.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard title="Company bank accounts" description="Tenants see these accounts when they pay rent">
      <div className="space-y-4 p-4">
        {companyBanks.length ? (
          <ul className="grid gap-2">
            {companyBanks.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{b.bank_name}{b.branch ? ` · ${b.branch}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{b.account_name} · <span className="font-mono">{b.account_number}</span></p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove bank account"
                  onClick={() => deleteCompanyBank(b.id).catch((e: Error) => toast.error(e.message))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No bank accounts added yet.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, l]) => (
            <div key={k} className="space-y-2">
              <Label htmlFor={`cb-${k}`}>{l}</Label>
              <Input id={`cb-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <Button onClick={add} disabled={busy}>
          <Plus className="size-4" /> Add bank account
        </Button>
      </div>
    </SectionCard>
  );
}
