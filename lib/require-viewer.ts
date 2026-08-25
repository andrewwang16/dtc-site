import { auth } from "@/auth";

export async function getViewerSession() {
  const session = await auth();

  return session?.user?.email ? session : null;
}
