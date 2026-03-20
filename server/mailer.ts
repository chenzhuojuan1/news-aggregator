import nodemailer from "nodemailer";
import type { EmailConfig } from "../drizzle/schema";

export async function sendReportEmail(
  config: EmailConfig,
  subject: string,
  htmlContent: string,
  textContent: string,
): Promise<{ success: boolean; error?: string }> {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return { success: false, error: "SMTP配置不完整，请先在邮件设置中配置SMTP服务器信息" };
  }

  const recipients = config.recipients as string[] | null;
  if (!recipients || recipients.length === 0) {
    return { success: false, error: "收件人列表为空，请先添加收件人邮箱" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.useSsl,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    await transporter.sendMail({
      from: config.fromName
        ? `"${config.fromName}" <${config.fromEmail || config.smtpUser}>`
        : config.fromEmail || config.smtpUser,
      to: recipients.join(", "),
      subject,
      html: htmlContent,
      text: textContent,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `邮件发送失败: ${err.message}` };
  }
}

export async function testSmtpConnection(
  config: Partial<EmailConfig>,
): Promise<{ success: boolean; error?: string }> {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return { success: false, error: "SMTP配置不完整" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.useSsl || false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: `SMTP连接测试失败: ${err.message}` };
  }
}
