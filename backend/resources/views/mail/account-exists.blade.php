<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Account security notice - {{ $appName ?? 'Cineora' }}</title>
<!--[if mso]>
<style type="text/css">
body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
</style>
<![endif]-->
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; margin: 0 auto !important; border-radius: 0 !important; }
    .email-content { padding: 24px 20px !important; }
    .btn-block { width: 100% !important; display: block !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #08090d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #f7f7f5;">

<!-- Preheader preview text -->
<div style="display: none; font-size: 1px; color: #08090d; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
  A registration was attempted with your email address, but an account already exists on Cineora.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #08090d; table-layout: fixed; width: 100%; min-width: 100%;">
  <tr>
    <td align="center" style="padding: 40px 16px;">
      
      <!-- Container card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-container" style="max-width: 580px; width: 100%; background-color: #12141a; border: 1px solid #232733; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.7);">
        
        <!-- Top Cinematic Accent Gradient Bar -->
        <tr>
          <td height="4" style="height: 4px; background: linear-gradient(90deg, #e96f25 0%, #f0782b 50%, #ffaa66 100%); font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>

        <!-- Brand Header -->
        <tr>
          <td align="center" style="padding: 36px 32px 28px 32px; background-color: #12141a; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td align="center" valign="middle" width="46" height="46" style="width: 46px; height: 46px; background: linear-gradient(135deg, #e96f25 0%, #f0782b 100%); border-radius: 12px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; box-shadow: 0 4px 16px rgba(240, 120, 43, 0.35);">
                  🎬
                </td>
                <td style="padding-left: 14px; text-align: left;">
                  <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; display: block; line-height: 24px;">{{ $appName ?? 'CINEORA' }}</span>
                  <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #f0782b; text-transform: uppercase; display: block; line-height: 12px; margin-top: 3px;">PREMIUM CINEMA EXPERIENCE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Email Body Content -->
        <tr>
          <td class="email-content" style="padding: 36px 36px 32px 36px; background-color: #12141a;">
            
            <!-- Security Badge -->
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="display: inline-block; background-color: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20px; padding: 5px 14px; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #93c5fd;">
                ACCOUNT SECURITY ALERT
              </span>
            </div>

            <!-- Heading -->
            <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
              Account Already Exists
            </h1>

            <!-- Intro text -->
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #a5aab8; text-align: center;">
              A registration attempt was recently made using your email address, but an account is already registered with Cineora.
            </p>

            <!-- Call to action button -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 28px auto;">
              <tr>
                <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #e96f25 0%, #f0782b 100%); box-shadow: 0 4px 18px rgba(240, 120, 43, 0.4);">
                  <a href="{{ $loginUrl ?? 'http://localhost:3000/login' }}" class="btn-block" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;">
                    Sign In to Your Account &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Secondary link -->
            <div style="text-align: center; margin-bottom: 28px; font-size: 14px; color: #8e95a5;">
              Forgot your password? <a href="{{ $forgotUrl ?? 'http://localhost:3000/forgot-password' }}" style="color: #f0782b; text-decoration: underline; font-weight: 600;">Reset your password here</a>
            </div>

            <!-- Security Advisory Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 12px;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="24" valign="top" style="padding-right: 12px; font-size: 16px; line-height: 22px;">🛡️</td>
                      <td valign="top" style="font-size: 13px; line-height: 20px; color: #9da4b4;">
                        <strong style="color: #e2e8f0;">Was this you?</strong> If you were trying to register, please sign in instead. You can reset your password anytime if you don't recall it.
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" height="10" style="height: 10px;"></td>
                    </tr>
                    <tr>
                      <td width="24" valign="top" style="padding-right: 12px; font-size: 16px; line-height: 22px;">🔒</td>
                      <td valign="top" style="font-size: 13px; line-height: 20px; color: #9da4b4;">
                        <strong style="color: #e2e8f0;">Wasn't you?</strong> You can safely ignore this email. No changes were made and nobody can access your account without your credentials.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background-color: #0c0e14; padding: 28px 32px; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
            
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 16px auto;">
              <tr>
                <td>
                  <a href="{{ $frontendUrl ?? 'http://localhost:3000' }}" style="font-size: 12px; font-weight: 600; color: #f0782b; text-decoration: none;">Visit Cineora</a>
                </td>
                <td style="padding: 0 10px; color: #374151; font-size: 11px;">•</td>
                <td>
                  <a href="{{ ($frontendUrl ?? 'http://localhost:3000') }}/browse" style="font-size: 12px; font-weight: 600; color: #9ca3af; text-decoration: none;">Now Showing</a>
                </td>
                <td style="padding: 0 10px; color: #374151; font-size: 11px;">•</td>
                <td>
                  <a href="{{ ($frontendUrl ?? 'http://localhost:3000') }}/support" style="font-size: 12px; font-weight: 600; color: #9ca3af; text-decoration: none;">Help & Support</a>
                </td>
              </tr>
            </table>

            <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 18px; color: #64748b;">
              &copy; {{ date('Y') }} {{ $appName ?? 'Cineora' }}. All rights reserved.
            </p>
            <p style="margin: 0; font-size: 11px; line-height: 16px; color: #475569;">
              This is an automated security notice. Please do not reply directly to this message.
            </p>

          </td>
        </tr>

      </table>
      <!-- End container card -->

    </td>
  </tr>
</table>

</body>
</html>
