import { put } from "@vercel/blob";
import { getAdminSession } from "@/lib/require-admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAdminSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return new Response("Invalid file", { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return new Response("File too large", { status: 400 });
  }

  try {
    const blob = await put(`article-covers/${crypto.randomUUID()}-${file.name}`, file, {
      access: "public",
    });

    return Response.json({ url: blob.url });
  } catch (error) {
    console.error("Blob upload failed", error);
    return new Response("Upload failed — check server logs", { status: 500 });
  }
}
