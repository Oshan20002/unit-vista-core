import { createFileRoute } from "@tanstack/react-router";
import { HardHat } from "lucide-react";
import { PartnerDirectory } from "@/components/app/PartnerDirectory";

export const Route = createFileRoute("/_app/technicians")({
  head: () => ({
    meta: [
      { title: "Technicians — Estora" },
      { name: "description", content: "Manage technicians who quote and carry out maintenance jobs." },
      { property: "og:title", content: "Technicians — Estora" },
      { property: "og:description", content: "Add technicians and issue their one-time registration codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PartnerDirectory kind="technician" icon={HardHat} />,
});
