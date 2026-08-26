import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/require-admin";
import SubscriberManager from "@/components/admin/SubscriberManager";

export default async function ManageSubscribersPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up" style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
        <p className="kicker">Admin</p>
        <h1 className="section-title">Manage Subscribers</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)" }}>
          Grant or revoke subscriber access, which unlocks paywalled articles and rolling trend
          charts for that account.
        </p>

        <div style={{ marginTop: "1.5rem" }}>
          <SubscriberManager />
        </div>
      </section>
    </div>
  );
}
