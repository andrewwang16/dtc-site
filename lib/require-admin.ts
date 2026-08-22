import { auth } from "@/auth";

export async function getAdminSession() {
  const session = await auth();

  return session?.user?.isAdmin ? session : null;
}
