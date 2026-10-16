import { createFileRoute } from "@tanstack/react-router";
import { FolderLock, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { useApp } from "@/lib/app-store";
import { formatDate } from "@/lib/format";
import type { DocumentCategory } from "@/lib/types";

export const Route = createFileRoute("/_app/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Estora" },
      { name: "description", content: "Secure document vault for leases, IDs, inspections, invoices and property paperwork." },
      { property: "og:title", content: "Documents — Estora" },
      { property: "og:description", content: "Upload, categorise and track expiry on every property document." },
    ],
  }),
  component: DocumentsPage,
});

const CATEGORIES: DocumentCategory[] = [
  "Lease Agreement",
  "Passport / ID",
  "Property Document",
  "Inspection Report",
  "Invoice",
  "Quotation",
  "Management Agreement",
  "Other",
];

function DocumentsPage() {
  const { scoped, addDocument, deleteDocument, user } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const canManage = user?.role !== "TENANT";

  const [form, setForm] = useState({
    name: "",
    category: "Lease Agreement" as DocumentCategory,
    property_id: "",
    expires_at: "",
    file_type: "PDF",
    file_size: "1.2 MB",
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.documents
      .filter((d) => (category === "all" ? true : d.category === category))
      .filter((d) => (q ? d.name.toLowerCase().includes(q) : true))
      .map((d) => ({
        ...d,
        propertyName: scoped.properties.find((p) => p.id === d.property_id)?.name ?? "—",
      }))
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  }, [scoped, query, category]);

  const submit = () => {
    if (form.name.trim().length < 3) {
      toast.error("Give the document a clear name.");
      return;
    }
    addDocument({
      name: form.name.trim(),
      category: form.category,
      property_id: form.property_id || undefined,
      expires_at: form.expires_at || undefined,
      file_type: form.file_type,
      file_size: form.file_size,
    });
    setOpen(false);
    setForm({ ...form, name: "", expires_at: "" });
    toast.success("Document uploaded.");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="A single vault for contracts, IDs, inspections and invoices."
        actions={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Upload className="size-4" /> Upload document
            </Button>
          ) : null
        }
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input placeholder="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard>
        <DataTable
          rows={rows}
          empty={
            <EmptyState
              icon={FolderLock}
              title="No documents"
              description="Upload leases, IDs and inspection reports to keep everything in one place."
              action={canManage ? <Button onClick={() => setOpen(true)}>Upload document</Button> : null}
            />
          }
          columns={[
            {
              key: "name",
              header: "Document",
              primary: true,
              render: (d) => (
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.file_type} · {d.file_size}
                  </p>
                </div>
              ),
            },
            { key: "cat", header: "Category", render: (d) => d.category },
            { key: "property", header: "Property", render: (d) => d.propertyName },
            { key: "uploaded", header: "Uploaded", render: (d) => formatDate(d.uploaded_at) },
            { key: "by", header: "Uploaded by", hideOnMobile: true, render: (d) => d.uploaded_by },
            { key: "expires", header: "Expires", render: (d) => formatDate(d.expires_at) },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (d) =>
                canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocument(d.id);
                      toast.success("Document deleted.");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null,
            },
          ]}
        />
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>Attach paperwork to a property and set an expiry reminder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="d-name">Document name</Label>
              <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tenancy contract – Unit 1204" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as DocumentCategory })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {scoped.properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-exp">Expiry date</Label>
                <Input id="d-exp" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-type">File type</Label>
                <Input id="d-type" value={form.file_type} onChange={(e) => setForm({ ...form, file_type: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
