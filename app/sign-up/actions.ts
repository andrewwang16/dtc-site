"use server";

import bcrypt from "bcryptjs";
import { getUserByEmail, createViewerAccount } from "@/lib/users";
import { ADMIN_EMAILS } from "@/lib/admin-emails";

export type SignUpResult = { ok: true } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUpAction(input: {
  email: string;
  password: string;
}): Promise<SignUpResult> {
  const email = input.email.toLowerCase().trim();
  const password = input.password;

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  if (ADMIN_EMAILS.has(email)) {
    return {
      ok: false,
      error: "This email is reserved. Contact the site admin if this is your account.",
    };
  }

  try {
    const existing = await getUserByEmail(email);

    if (existing) {
      return { ok: false, error: "An account with that email already exists." };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await createViewerAccount(email, passwordHash);

    return { ok: true };
  } catch (error) {
    console.error("Failed to create account", error);
    return { ok: false, error: "Something went wrong creating your account." };
  }
}
