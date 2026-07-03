import nodemailer, { Transporter } from "nodemailer";
import { IMailProvider } from "../mail.interface";

interface NodemailerConfig {
  service: string;
  host: string;
  port: number;
  auth: { user: string; password: string };
}

export class NodemailerProvider implements IMailProvider {
  private _transporter: Transporter;
  constructor(config: NodemailerConfig) {
    this._transporter = nodemailer.createTransport({
      service: config.service,
      host: config.host,
      port: config.port,
      auth: {
        user: config.auth.user,
        pass: config.auth.password,
      },
      // Render's free tier has unreliable outbound IPv6 to Gmail SMTP;
      // force IPv4 rather than waiting out an IPv6 attempt first.
      family: 4,
      // Fail fast instead of hanging on the default 2 min connection
      // timeout - a short timeout + one retry recovers faster from a
      // transient blip than a single long-hanging attempt would.
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      // `family` is a real nodemailer/SMTPConnection option (passed
      // through to Node's socket connect), just missing from
      // @types/nodemailer's declarations.
    } as nodemailer.TransportOptions);
  }
  async send(to: string, subject: string, html: string) {
    try {
      await this._transporter.sendMail({ to, subject, html });
    } catch (err) {
      console.log("mail send failed, retrying once:", (err as Error).message);
      await this._transporter.sendMail({ to, subject, html });
    }
  }
}
