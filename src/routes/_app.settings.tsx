import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { useApp } from "@/lib/app-store";
import { roleLabel } from "@/lib/nav";
import { CompanyBanksCard } from "@/components/app/CompanyBanksCard";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Estora" },
      { name: "description", content: "Manage your profile, notification preferences and account security." },
      { property: "og:title", content: "Profile & Settings — Estora" },
      { property: "og:description", content: "Update your details, alerts and password in one place." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, backend, updatePassword, logAction } = useApp();
  const [profile, setProfile] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  });
  const [prefs, setPrefs] = useState({ rent: true, maintenance: true, approvals: true, digest: false });
  const [password, setPassword] = useState({ next: "", confirm: "" });

  const saveProfile = () => {
    if (profile.full_name.trim().length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    logAction("Updated profile", "user", user?.id ?? "");
    toast.success("Profile saved.");
  };

  const savePassword = async () => {
    if (password.next.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password.next !== password.confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    await updatePassword(password.next);
    setPassword({ next: "", confirm: "" });
    toast.success("Password updated.");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Profile & settings" description="Your details, alerts and security preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Profile" description={user ? roleLabel[user.role] : ""}>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">Full name</Label>
              <Input id="s-name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <Button className="w-fit" onClick={saveProfile}>
              Save profile
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Notification preferences" description="Choose what you want to hear about">
          <div className="space-y-4">
            <Pref
              label="Rent reminders"
              hint="Upcoming, due and overdue payments"
              checked={prefs.rent}
              onChange={(v) => setPrefs({ ...prefs, rent: v })}
            />
            <Pref
              label="Maintenance updates"
              hint="Status changes on your tickets"
              checked={prefs.maintenance}
              onChange={(v) => setPrefs({ ...prefs, maintenance: v })}
            />
            <Pref
              label="Approval requests"
              hint="Spend awaiting your decision"
              checked={prefs.approvals}
              onChange={(v) => setPrefs({ ...prefs, approvals: v })}
            />
            <Pref
              label="Weekly digest"
              hint="A Monday summary of portfolio activity"
              checked={prefs.digest}
              onChange={(v) => setPrefs({ ...prefs, digest: v })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Security" description="Update your password">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-pass">New password</Label>
              <Input id="s-pass" type="password" value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-pass2">Confirm password</Label>
              <Input id="s-pass2" type="password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} />
            </div>
            <Button className="w-fit" onClick={() => void savePassword()}>
              Update password
            </Button>
          </div>
        </SectionCard>

        {user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER" ? <CompanyBanksCard /> : null}

        <SectionCard title="Workspace" description="How this app is currently running">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">
                {backend === "supabase" ? "Connected to your Supabase project" : "Running on the built-in demo dataset"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {backend === "supabase"
                  ? "Authentication and data are served from your own Supabase instance."
                  : "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect your own Supabase project. Until then, all data is local demo data."}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Pref({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
