import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Has the current user actually provisioned a number yet, not just paid for the service? */
export async function hasProvisionedVoiceNumber(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("voice_settings")
    .select("twilio_phone_number")
    .eq("owner_id", user.id)
    .maybeSingle<{ twilio_phone_number: string | null }>();

  return !!data?.twilio_phone_number;
}
