import {
  Bell,
  Building2,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  Truck,
  CreditCard,
  FileText,
  FolderLock,
  Gauge,
  Home,
  KeyRound,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UserSquare2,
  Wrench,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const staff: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: Gauge },
  { label: "Properties", to: "/properties", icon: Building2 },
  { label: "Owners", to: "/owners", icon: Users },
  { label: "Tenants", to: "/tenants", icon: UserSquare2 },
  { label: "Leases", to: "/leases", icon: KeyRound },
  { label: "Rent & Payments", to: "/rent", icon: CreditCard },
  { label: "Maintenance", to: "/maintenance", icon: Wrench },
  { label: "Technicians", to: "/technicians", icon: HardHat },
  { label: "Vendors", to: "/vendors", icon: Truck },
  { label: "Approvals", to: "/approvals", icon: ClipboardCheck },
  { label: "Documents", to: "/documents", icon: FolderLock },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Notifications", to: "/notifications", icon: Bell },
];

export const navFor = (role: Role): NavItem[] => {
  if (role === "ADMIN")
    return [
      ...staff,
      { label: "Audit Logs", to: "/audit-logs", icon: ScrollText },
      { label: "Settings", to: "/settings", icon: Settings },
    ];
  if (role === "PROPERTY_MANAGER") return [...staff, { label: "Settings", to: "/settings", icon: Settings }];
  if (role === "LANDLORD")
    return [
      { label: "Dashboard", to: "/investor", icon: Gauge },
      { label: "My Properties", to: "/properties", icon: Building2 },
      { label: "Rent & Income", to: "/rent", icon: CreditCard },
      { label: "Payments to receive", to: "/payouts", icon: Wallet },
      { label: "Maintenance", to: "/maintenance", icon: Wrench },
      { label: "Approvals", to: "/approvals", icon: ClipboardCheck },
      { label: "Documents", to: "/documents", icon: FolderLock },
      { label: "Reports", to: "/reports", icon: FileText },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Profile", to: "/settings", icon: ShieldCheck },
    ];
  if (role === "TECHNICIAN" || role === "VENDOR")
    return [
      { label: role === "TECHNICIAN" ? "My jobs" : "Quotation requests", to: "/jobs", icon: ClipboardList },
      { label: "To receive payment", to: "/payouts", icon: Wallet },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Profile", to: "/settings", icon: ShieldCheck },
    ];
  return [
    { label: "Dashboard", to: "/portal", icon: Home },
    { label: "My Lease", to: "/leases", icon: KeyRound },
    { label: "Rent", to: "/rent", icon: CreditCard },
    { label: "Maintenance", to: "/maintenance", icon: Wrench },
    { label: "Documents", to: "/documents", icon: FolderLock },
    { label: "Notifications", to: "/notifications", icon: Bell },
    { label: "Profile", to: "/settings", icon: ShieldCheck },
  ];
};

export const roleLabel: Record<Role, string> = {
  ADMIN: "Administrator",
  PROPERTY_MANAGER: "Property Manager",
  LANDLORD: "Landlord / Investor",
  TENANT: "Tenant",
  TECHNICIAN: "Technician",
  VENDOR: "Vendor",
};
