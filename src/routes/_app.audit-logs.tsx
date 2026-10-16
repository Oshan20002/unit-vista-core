import { createFileRoute } from "@tanstack/react-router";
import { Download, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { useApp } from "@/lib/app-store";
import { downloadCsv, formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/nav";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/_app/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — Estora" },
      { name: "description", content: "Immutable record of every platform action, actor, device and timestamp." },
      { property: "og:title", content: "Audit Logs — Estora" },
      { property: "og:description", content: "Full traceability of who changed what, and when." },
    ],
  }),
  component: AuditLogsPage,
});

const ROLES: Role[] = ["ADMIN", "PROPERTY_MANAGER", "LANDLORD", "TENANT"];

function AuditLogsPage() {
  const { scoped } = useApp();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.auditLogs
      .filter((l) => (role === "all" ? true : l.role === role))
      .filter((l) => (q ? `${l.user_name} ${l.action} ${l.entity} ${l.entity_id}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [scoped, query, role]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit logs"
        description="Every action taken on the platform, with actor and device."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "audit-logs",
                rows.map((l) => ({
                  When: l.at,
                  User: l.user_name,
                  Role: l.role,
                  Action: l.action,
                  Entity: l.entity,
                  "Entity ID": l.entity_id,
                  IP: l.ip,
                })),
              )
            }
          >
            <Download className="size-4" /> Export
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input placeholder="Search actions, users or records" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {roleLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard>
        <DataTable
          rows={rows}
          empty={<EmptyState icon={ScrollText} title="No audit entries" description="Platform actions will be recorded here." />}
          columns={[
            {
              key: "action",
              header: "Action",
              primary: true,
              render: (l) => (
                <div>
                  <p className="font-medium">{l.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.entity} · {l.entity_id}
                  </p>
                </div>
              ),
            },
            { key: "user", header: "User", render: (l) => l.user_name },
            { key: "role", header: "Role", render: (l) => roleLabel[l.role] },
            { key: "at", header: "When", render: (l) => formatDateTime(l.at) },
            { key: "ip", header: "IP", hideOnMobile: true, render: (l) => l.ip },
            { key: "device", header: "Device", hideOnMobile: true, render: (l) => l.device },
          ]}
        />
      </SectionCard>
    </div>
  );
}
