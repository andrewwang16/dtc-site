import SetupPanel from "@/components/setup/SetupPanel";

type SetupPageProps = {
  searchParams: Promise<{ key?: string }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const { key } = await searchParams;
  const expected = process.env.SETUP_SECRET;

  if (!expected || key !== expected) {
    return (
      <div className="container" style={{ paddingTop: "2.2rem", paddingBottom: "4rem" }}>
        <p className="kicker">Setup</p>
        <h1 className="section-title">Not Found</h1>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">One-Time Setup</p>
        <h1 className="section-title">Site Setup</h1>

        <div style={{ marginTop: "1.5rem" }}>
          <SetupPanel setupKey={key} />
        </div>
      </section>
    </div>
  );
}
