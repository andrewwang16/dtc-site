import { redirect } from "next/navigation";
import { getViewerSession } from "@/lib/require-viewer";
import { getUserByEmail } from "@/lib/users";
import AccountSettingsForm from "@/components/account/AccountSettingsForm";

export default async function AccountPage() {
  const session = await getViewerSession();

  if (!session?.user?.email) {
    redirect("/sign-in");
  }

  const user = await getUserByEmail(session.user.email);

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Account</p>
        <h1 className="section-title">Manage Account</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Update how your name appears across the site and change your password.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <AccountSettingsForm
          email={session.user.email}
          displayName={user?.displayName ?? ""}
          isAdmin={Boolean(session.user.isAdmin)}
          isSubscriber={Boolean(session.user.isSubscriber)}
        />
      </section>
    </div>
  );
}
