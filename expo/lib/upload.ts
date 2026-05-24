import { supabase } from "@/lib/supabase";

/**
 * Upload a local file (file:// or http(s)://) to the public `photos` bucket
 * and return the public URL.
 */
export async function uploadPhoto(
  localUri: string,
  pathPrefix: string
): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = (blob.type?.split("/")?.[1] ?? "jpg").replace("jpeg", "jpg");
  const filename = `${pathPrefix}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("photos").upload(filename, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("photos").getPublicUrl(filename);
  return data.publicUrl;
}
