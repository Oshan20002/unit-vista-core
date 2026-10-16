import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { PartnerDirectory } from "@/components/app/PartnerDirectory";

export const Route = createFileRoute("/_app/vendors")({
  head: () => ({
    meta: [
      { title: "Vendors — Estora" },
      { name: "description", content: "Manage vendors who price materials for maintenance jobs." },
      { property: "og:title", content: "Vendors — Estora" },
      { property: "og:description", content: "Add vendors and issue their one-time registration codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PartnerDirectory kind="vendor" icon={Truck} />,
});
