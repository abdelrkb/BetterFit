import { createTransport, type Transporter } from 'nodemailer';
import { env } from '../env.js';

/**
 * Envoi d'e-mails.
 *
 * Tant qu'aucun serveur SMTP n'est configuré (le fournisseur reste à choisir
 * avec le porteur du projet), les messages sont écrits dans la console : le
 * parcours « mot de passe oublié » reste testable de bout en bout.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

let transporter: Transporter | null = null;

function smtpTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;

  transporter ??= createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  return transporter;
}

/** Vrai quand un serveur SMTP est configuré. */
export function mailIsConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

export async function sendMail(mail: Mail): Promise<void> {
  const smtp = smtpTransporter();

  if (!smtp) {
    console.info(
      [
        '',
        '─── E-mail non envoyé : aucun serveur SMTP configuré ───',
        `À       : ${mail.to}`,
        `Objet   : ${mail.subject}`,
        '',
        mail.text,
        '───────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return;
  }

  await smtp.sendMail({ from: env.MAIL_FROM, ...mail });
}
