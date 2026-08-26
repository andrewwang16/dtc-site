import SignUpForm from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Sign Up</p>
        <h1 className="section-title">Create an Account</h1>

        <div style={{ marginTop: "1.5rem" }}>
          <SignUpForm />
        </div>
      </section>
    </div>
  );
}
