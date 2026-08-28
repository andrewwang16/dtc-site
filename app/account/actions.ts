"use server";

import bcrypt from "bcryptjs";
import { getViewerSession } from "@/lib/require-viewer";
import { getUserByEmail, updateDisplayName, updatePasswordHash } from "@/lib/users";
import { revalidatePath } from "next/cache";

export type AccountActionResult = { ok: true } | { ok: false; error: string };

export async function updateDisplayNameAction(displayName: string): Promise<AccountActionResult> {
  const session = await getViewerSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Sign in to update your account." };
  }

  const trimmed = displayName.trim();

  if (!trimmed) {
    return { ok: false, error: "Display name can't be empty." };
  }

  if (trimmed.length > 60) {
    return { ok: false, error: "Display name is limited to 60 characters." };
  }

  try {
    await updateDisplayName(session.user.email, trimmed);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update display name", error);
    return { ok: false, error: "Something went wrong updating your display name." };
  }
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AccountActionResult> {
  const session = await getViewerSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Sign in to update your account." };
  }

  if (input.newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  try {
    const user = await getUserByEmail(session.user.email);

    if (!user) {
      return { ok: false, error: "Account not found." };
    }

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);

    if (!isValid) {
      return { ok: false, error: "Current password is incorrect." };
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await updatePasswordHash(session.user.email, passwordHash);

    return { ok: true };
  } catch (error) {
    console.error("Failed to change password", error);
    return { ok: false, error: "Something went wrong changing your password." };
  }
}
