import { supabase } from "./supabase";

export async function schedulePlanReal(
 planId: string,
 startsAt: Date,
 endsAt: Date
): Promise<{ ok: boolean; scheduledAt?: Date; error?: string }> {
 const start = startsAt.getTime();
 const end = endsAt.getTime();
 const duration = end - start;
 const min = start + duration * 0.2;
 const max = start + duration * 0.8;
 const scheduledAt = new Date(min + Math.random() * (max - min));

 const { error } = await supabase
 .from("plans")
 .update({ planreal_scheduled_at: scheduledAt.toISOString() })
 .eq("id", planId);
 if (error) return { ok: false, error: error.message };
 return { ok: true, scheduledAt };
}

export async function checkAndFirePlanReal(planId: string): Promise<{
 shouldFire: boolean;
 alreadyFired: boolean;
}> {
 const { data, error } = await supabase
 .from("plans")
 .select("planreal_scheduled_at, planreal_fired_at, status")
 .eq("id", planId)
 .single();
 if (error || !data) return { shouldFire: false, alreadyFired: false };
 if (data.planreal_fired_at) return { shouldFire: false, alreadyFired: true };
 if (data.status !== "active") return { shouldFire: false, alreadyFired: false };
 if (!data.planreal_scheduled_at) return { shouldFire: false, alreadyFired: false };

 const scheduledAt = new Date(data.planreal_scheduled_at);
 if (new Date() >= scheduledAt) {
 await supabase
 .from("plans")
 .update({ planreal_fired_at: new Date().toISOString() })
 .eq("id", planId)
 .is("planreal_fired_at", null);
 return { shouldFire: true, alreadyFired: false };
 }
 return { shouldFire: false, alreadyFired: false };
}

export async function submitPlanRealPhoto(
 planId: string,
 userId: string,
 photoUri: string
): Promise<{ ok: boolean; photoUrl?: string; error?: string }> {
 const fileName = `planreal/${planId}/${userId}_${Date.now()}.jpg`;
 const response = await fetch(photoUri);
 const blob = await response.blob();
 const arrayBuffer = await blob.arrayBuffer();
 const uint8Array = new Uint8Array(arrayBuffer);

 const { data: uploadData, error: uploadError } = await supabase.storage
 .from("photos")
 .upload(fileName, uint8Array, { contentType: "image/jpeg", upsert: true });
 if (uploadError) return { ok: false, error: uploadError.message };

 const { data: urlData } = supabase.storage.from("photos").getPublicUrl(uploadData.path);
 const photoUrl = urlData.publicUrl;

 const { error: updateError } = await supabase
 .from("plan_members")
 .update({ photo_url: photoUrl, submitted_at: new Date().toISOString() })
 .eq("plan_id", planId)
 .eq("user_id", userId);
 if (updateError) return { ok: false, error: updateError.message };

 return { ok: true, photoUrl };
}

export async function getPlanRealSubmissions(planId: string): Promise<{
 total: number;
 submitted: number;
 photos: { userId: string; photoUrl: string }[];
 allSubmitted: boolean;
}> {
 const { data, error } = await supabase
 .from("plan_members")
 .select("user_id, photo_url, submitted_at")
 .eq("plan_id", planId);
 if (error || !data) return { total: 0, submitted: 0, photos: [], allSubmitted: false };

 const total = data.length;
 const submitted = data.filter((m) => m.submitted_at && m.photo_url).length;
 const photos = data
 .filter((m) => m.photo_url)
 .map((m) => ({ userId: m.user_id, photoUrl: m.photo_url as string }));

 return { total, submitted, photos, allSubmitted: submitted === total && total > 0 };
}

export function subscribeToPlanRealSubmissions(
 planId: string,
 onUpdate: (submissions: { userId: string; submitted: boolean }[]) => void
) {
 return supabase
 .channel(`planreal:${planId}`)
 .on("postgres_changes", {
 event: "UPDATE",
 schema: "public",
 table: "plan_members",
 filter: `plan_id=eq.${planId}`,
 }, async () => {
 const { data } = await supabase
 .from("plan_members")
 .select("user_id, submitted_at")
 .eq("plan_id", planId);
 if (data) {
 onUpdate(data.map((m) => ({ userId: m.user_id, submitted: !!m.submitted_at })));
 }
 })
 .subscribe();
}

export function subscribeToMosaicReady(
 planId: string,
 onMosaicReady: (mosaicUrl: string) => void
) {
 return supabase
 .channel(`mosaic:${planId}`)
 .on("postgres_changes", {
 event: "UPDATE",
 schema: "public",
 table: "plans",
 filter: `id=eq.${planId}`,
 }, (payload) => {
 const newRecord = payload.new as { mosaic_url?: string };
 if (newRecord.mosaic_url) onMosaicReady(newRecord.mosaic_url);
 })
 .subscribe();
}
