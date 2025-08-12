import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const sendMagicLinkEmail = async (email: string, magicLink: string, userName?: string) => {
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
            to: [email],
            subject: 'Your Vendro Login Link',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vendro Login</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #D4622A; margin: 0; font-size: 28px;">🏕️ Vendro</h1>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Welcome back${userName ? `, ${userName}` : ''}!</h2>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Click the button below to securely log in to your Vendro account. This link will expire in 15 minutes for your security.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="background: #D4622A; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                🚀 Log in to Vendro
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 25px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #666; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; border-left: 3px solid #D4622A;">
              ${magicLink}
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="font-size: 14px; color: #999; margin: 0;">
              Happy travels! 🎒<br>
              The Vendro Team
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 15px;">
              If you didn't request this login link, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
        });

        if (error) {
            console.error('❌ Resend error:', error);
            throw new Error('Failed to send email');
        }

        console.log('✅ Magic link email sent:', data?.id);
        return data;
    } catch (error) {
        console.error('❌ Error sending magic link email:', error);
        throw error;
    }
};