import { RESEND_API_KEY, RESEND_FROM_EMAIL } from "../../../config";
import { ResendProvider } from "./resend.service";

export const resendProvider = new ResendProvider({
  apiKey: RESEND_API_KEY,
  from: RESEND_FROM_EMAIL,
});
