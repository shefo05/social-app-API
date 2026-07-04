import sgMail from "@sendgrid/mail";
import { IMailProvider } from "../mail.interface";

interface SendgridConfig {
  apiKey: string;
  from: string;
}

interface SendgridErrorBody {
  errors?: Array<{ message: string; field?: string | null; help?: unknown }>;
}

export class SendgridProvider implements IMailProvider {
  constructor(private _config: SendgridConfig) {
    sgMail.setApiKey(_config.apiKey);
  }

  async send(to: string, subject: string, html: string) {
    try {
      await sgMail.send({ to, from: this._config.from, subject, html });
    } catch (err) {
      const response = (err as { response?: { body?: SendgridErrorBody } })
        .response;
      const detail = response?.body?.errors
        ? response.body.errors.map((e) => e.message).join("; ")
        : (err as Error).message;
      throw new Error(`SendGrid API error: ${detail}`);
    }
  }
}
