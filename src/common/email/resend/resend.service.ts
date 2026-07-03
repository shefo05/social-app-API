import { IMailProvider } from "../mail.interface";

interface ResendConfig {
  apiKey: string;
  from: string;
}

export class ResendProvider implements IMailProvider {
  constructor(private _config: ResendConfig) {}

  async send(to: string, subject: string, html: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this._config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this._config.from,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Resend API error (${res.status}): ${errorBody}`);
    }
  }
}
