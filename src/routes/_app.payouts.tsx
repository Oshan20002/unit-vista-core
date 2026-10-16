import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { StatementView } from "@/components/app/PaymentWidgets";
import { useApp } from "@/lib/app-store";
import { landlordStatement, technicianStatement, vendorStatement } from "@/lib/payouts";

export const Route = createFileRoute("/_app/payouts")({
  head: () => ({
    meta: [
      { title: "Payments to receive — Estora" },
      { name: "description", content: "What you are owed, how it is calculated, and payments to confirm." },
      { property: "og:title", content: "Payments to receive — Estora" },
      { property: "og:description", content: "See your balance and confirm payments from the property manager." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayoutsPage,
});

function PayoutsPage() {
  const { user, scoped, confirmPayoutReceived } = useApp();
  if (!user) return null;
  const statement =
    user.role === "LANDLORD" && user.owner_id
      ? landlordStatement(user.owner_id, scoped)
      : user.role === "VENDOR" && user.vendor_id
        ? vendorStatement(user.vendor_id, scoped)
        : user.role === "TECHNICIAN" && user.technician_id
          ? technicianStatement(user.technician_id, scoped)
          : null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments to receive"
        description={
          user.role === "LANDLORD"
            ? "Rent collected minus vendor, technician and management costs. Confirm each payment once it reaches your bank."
            : "Your completed orders and payments. Confirm each payment once it reaches your bank."
        }
      />
      {statement ? (
        <StatementView
          statement={statement}
          earnedTitle={user.role === "LANDLORD" ? "Rent and deductions" : "Orders"}
          showDeductions={user.role === "LANDLORD"}
          onConfirm={confirmPayoutReceived}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Your account is not linked to a record yet.</p>
      )}
    </div>
  );
}
