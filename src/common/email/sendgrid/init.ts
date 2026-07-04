import { SENDGRID_API_KEY, SENDGRID_FROM_EMAIL } from "../../../config";
import { SendgridProvider } from "./sendgrid.service";

export const sendgridProvider = new SendgridProvider({
  apiKey: SENDGRID_API_KEY,
  from: SENDGRID_FROM_EMAIL,
});
