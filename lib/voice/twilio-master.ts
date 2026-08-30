import twilio from "twilio";

let masterClient: ReturnType<typeof twilio> | null = null;

/**
 * Qp Digital's own top-level Twilio account — used to create a Subaccount
 * (and buy a number under it) for each AI Reception subscriber. Clients
 * never see or enter Twilio credentials; this platform account is billed
 * for every client's usage, so number provisioning/release (see
 * lib/voice/provisioning.ts) matters for cost control.
 */
export function getMasterTwilioClient() {
  if (!masterClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error(
        "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set. Add your platform Twilio account credentials (see .env.example)."
      );
    }
    masterClient = twilio(sid, token);
  }
  return masterClient;
}
