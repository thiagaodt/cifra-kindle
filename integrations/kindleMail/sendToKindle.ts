import nodemailer from "nodemailer";
import { env } from "../../config/env";

/**
 * Envia o arquivo EPUB gerado para o e-mail Send-to-Kindle via SMTP
 * (Gmail pessoal com App Password configurado como Approved Sender, C-11).
 */
export async function sendEpub(buffer: Buffer, filename: string): Promise<void> {
    if (!env.smtpUser || !env.smtpPass || !env.kindleEmailTo) {
        throw new Error(
            "Configuração SMTP incompleta: defina SMTP_USER, SMTP_PASS e KINDLE_EMAIL_TO no .env."
        );
    }

    const safeFilename = filename.toLowerCase().endsWith(".epub")
        ? filename
        : `${filename}.epub`;

    const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: {
            user: env.smtpUser,
            pass: env.smtpPass,
        },
    });

    await transporter.sendMail({
        from: env.smtpUser,
        to: env.kindleEmailTo,
        subject: safeFilename,
        text: "Arquivo EPUB multi-tom enviado automaticamente pelo Adaptador de Cifras para Kindle.",
        attachments: [
            {
                filename: safeFilename,
                content: buffer,
                contentType: "application/epub+zip",
            },
        ],
    });
}
