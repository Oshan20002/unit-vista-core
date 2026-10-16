import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { homeRouteFor, useApp } from "@/lib/app-store";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Estora Property Platform" },
      {
        name: "description",
        content:
          "Sign in or create an Estora account to manage properties, leases, rent and maintenance.",
      },
      { property: "og:title", content: "Sign in — Estora Property Platform" },
      {
        property: "og:description",
        content: "Role-based access for administrators, property managers, landlords and tenants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const demoAccounts: { label: string; email: string }[] = [
  { label: "Admin", email: "admin@estora.app" },
  { label: "Property Manager", email: "manager@estora.app" },
  { label: "Landlord", email: "owner@estora.app" },
  { label: "Tenant", email: "tenant@estora.app" },
];

function AuthPage() {
  const { signIn, checkInviteEmail, verifyInviteCode, registerWithInvite, requestPasswordReset, user, loading, backend } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(backend === "demo" ? "manager@estora.app" : "");
  const [password, setPassword] = useState(backend === "demo" ? "demo1234" : "");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regStep, setRegStep] = useState<"email" | "code" | "password">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [tab, setTab] = useState("login");

  useEffect(() => {
    if (!loading && user) void navigate({ to: homeRouteFor(user.role), replace: true });
  }, [loading, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const account = await signIn(email, password);
      toast.success(`Welcome back, ${account.full_name.split(" ")[0]}`);
      void navigate({ to: homeRouteFor(account.role), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = regEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      if (regStep === "email") {
        const status = await checkInviteEmail(em);
        if (status === "not_found") {
          toast.error("You are not registered. Please contact your property manager.");
        } else if (status === "registered") {
          toast.info("This email already has an account. Please sign in.");
          setEmail(em);
          setPassword("");
          setTab("login");
        } else {
          setRegStep("code");
        }
      } else if (regStep === "code") {
        if (!/^[A-Za-z0-9]{6}$/.test(regCode.trim())) {
          toast.error("Enter the 6-character code from your property manager.");
          return;
        }
        if (await verifyInviteCode(em, regCode)) setRegStep("password");
        else toast.error("That code is not correct.");
      } else {
        if (regPassword.length < 8) {
          toast.error("Password must be at least 8 characters.");
          return;
        }
        if (regPassword !== regConfirm) {
          toast.error("Passwords do not match.");
          return;
        }
        const result = await registerWithInvite({ email: em, code: regCode, password: regPassword });
        if (result.requiresEmailConfirmation) {
          setConfirmationEmail(em);
        } else {
          toast.success("Password set. You can now sign in.");
          setEmail(em);
          setPassword("");
          setTab("login");
        }
        setRegStep("email");
        setRegCode("");
        setRegPassword("");
        setRegConfirm("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to register.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(resetEmail);
      toast.success("If that email exists, a reset link is on its way.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-4.5" />
          </span>
          <span className="text-base font-semibold text-sidebar-accent-foreground">Estora</span>
        </Link>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-sidebar-accent-foreground">
            Every owner, unit, lease and ticket in one operating system.
          </h2>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Role-based dashboards keep landlords on their own portfolio, tenants on their own
            tenancy and managers in full control.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          {backend === "supabase"
            ? "Connected to your Supabase project"
            : "Demo mode — connect Supabase to go live"}
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="forgot">Reset</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <h1 className="text-xl font-semibold">Sign in to Estora</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Use your work email to access your dashboard.
              </p>
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
                </Button>
              </form>

              {backend === "demo" ? (
                <div className="mt-6 rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Demo accounts · password demo1234
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {demoAccounts.map((a) => (
                      <button
                        key={a.email}
                        type="button"
                        onClick={() => {
                          setEmail(a.email);
                          setPassword("demo1234");
                        }}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              {confirmationEmail ? (
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <CheckCircle2 className="mx-auto size-9 text-accent" />
                  <h1 className="mt-4 text-xl font-semibold">Confirm your email</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We sent a confirmation link to{" "}
                    <span className="font-medium text-foreground">{confirmationEmail}</span>. Open
                    it before signing in.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-5"
                    onClick={() => setConfirmationEmail(null)}
                  >
                    Use another email
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold">Activate your account</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Registration is by invitation only. Use the email your property manager added
                    and the one-time code they sent you.
                  </p>
                  <form onSubmit={handleRegister} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        disabled={regStep !== "email"}
                        onChange={(e) => setRegEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    {regStep !== "email" ? (
                      <div className="space-y-2">
                        <Label htmlFor="reg-code">One-time code</Label>
                        <Input
                          id="reg-code"
                          value={regCode}
                          maxLength={6}
                          disabled={regStep !== "code"}
                          className="font-mono uppercase tracking-[0.3em]"
                          placeholder="A1B2C3"
                          onChange={(e) => setRegCode(e.target.value.toUpperCase())}
                        />
                      </div>
                    ) : null}
                    {regStep === "password" ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="reg-password">New password</Label>
                          <Input
                            id="reg-password"
                            type="password"
                            value={regPassword}
                            autoComplete="new-password"
                            onChange={(e) => setRegPassword(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reg-confirm">Confirm password</Label>
                          <Input
                            id="reg-confirm"
                            type="password"
                            value={regConfirm}
                            autoComplete="new-password"
                            onChange={(e) => setRegConfirm(e.target.value)}
                          />
                        </div>
                      </>
                    ) : null}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                      {regStep === "email" ? "Continue" : regStep === "code" ? "Verify code" : "Set password"}
                    </Button>
                    {regStep !== "email" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setRegStep("email");
                          setRegCode("");
                        }}
                      >
                        Use a different email
                      </Button>
                    ) : null}
                  </form>
                </>
              )}
            </TabsContent>

            <TabsContent value="forgot" className="mt-6">
              <h1 className="text-xl font-semibold">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email a secure link to set a new password.
              </p>
              <form onSubmit={handleReset} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Send reset link
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
