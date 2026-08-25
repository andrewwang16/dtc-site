"use server";

import { getAdminSession } from "@/lib/require-admin";
import { getUserByEmail, setSubscriberStatus } from "@/lib/users";

export type SubscriberActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function setSubscriberStatusAction(
  email: string,
  isSubscriber: boolean
): Promise<SubscriberActionResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, error: "Not authorized." };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail) {
    return { ok: false, error: "Enter an email address." };
  }

  try {
    const existing = await getUserByEmail(normalizedEmail);

    if (!existing) {
      return {
        ok: false,
        error: "No account found for that email — they need to sign up first.",
      };
    }

    await setSubscriberStatus(normalizedEmail, isSubscriber);

    return {
      ok: true,
      message: isSubscriber
        ? `${normalizedEmail} is now a subscriber.`
        : `${normalizedEmail} is no longer a subscriber.`,
    };
  } catch (error) {
    console.error("Failed to update subscriber status", error);
    return { ok: false, error: "Something went wrong — check server logs." };
  }
}
