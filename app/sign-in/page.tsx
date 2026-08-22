import { Suspense } from "react";
import SignInForm from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <div style={{ display: "grid", gap: "2rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Sign In</p>
        <h1 className="section-title">Admin Sign In</h1>

        <div style={{ marginTop: "1.5rem" }}>
          <Suspense fallback={null}>
            <SignInForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
