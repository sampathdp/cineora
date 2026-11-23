<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $code }} is your Cineora verification code</title>
<!--[if mso]>
<style type="text/css">
body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
</style>
<![endif]-->
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; margin: 0 auto !important; border-radius: 0 !important; }
    .email-content { padding: 24px 20px !important; }
    .digit-cell { width: 42px !important; height: 52px !important; font-size: 26px !important; line-height: 52px !important; }
    .digit-spacing { width: 4px !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #08090d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #f7f7f5;">

<!-- Preheader preview text -->
<div style="display: none; font-size: 1px; color: #08090d; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
  Your 6-digit Cineora verification code is {{ $code }}. This code expires in {{ $ttl ?? 10 }} minutes.
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
              <span style="display: inline-block; background-color: rgba(240, 120, 43, 0.12); border: 1px solid rgba(240, 120, 43, 0.3); border-radius: 20px; padding: 5px 14px; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #ff9a58;">
                ONE-TIME VERIFICATION CODE
              </span>
            </div>

            <!-- Heading -->
            <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
              Verify Your Email Address
            </h1>

            <!-- Intro text -->
            <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 24px; color: #a5aab8; text-align: center;">
              Hello{{ !empty($name) ? ' ' . e($name) : '' }}! Use this 6-digit verification code to confirm your email and secure your Cineora account.
            </p>

            <!-- OTP Box Container -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b0d12; border: 1px solid rgba(240, 120, 43, 0.35); border-radius: 14px; margin-bottom: 28px; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);">
              <tr>
                <td align="center" style="padding: 28px 16px 24px 16px;">
                  
                  <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #8e95a5; margin-bottom: 16px;">
                    YOUR VERIFICATION CODE
                  </div>

                  <!-- 6 Digits in Cells -->
                  @php
                    $digits = str_split(str_pad((string)$code, 6, '0', STR_PAD_LEFT));
                  @endphp
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                    <tr>
                      @foreach ($digits as $digit)
                      <td align="center" valign="middle" width="50" height="62" class="digit-cell" style="width: 50px; height: 62px; background-color: #171b26; border: 1.5px solid #f0782b; border-radius: 10px; font-size: 32px; font-weight: 900; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, 'Courier New', monospace; text-align: center; line-height: 62px; box-shadow: 0 4px 14px rgba(240, 120, 43, 0.18);">
                        {{ $digit }}
                      </td>
                      @if (!$loop->last)
                      <td width="8" class="digit-spacing" style="width: 8px;"></td>
                      @endif
                      @endforeach
                    </tr>
                  </table>

                  <!-- Copy-paste fallback -->
                  <div style="margin-top: 18px; font-size: 13px; color: #7e8596;">
                    Direct copy: <span style="font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, monospace; font-size: 15px; font-weight: 700; color: #f0782b; letter-spacing: 2px; padding: 3px 8px; background-color: #171b26; border-radius: 6px; border: 1px solid rgba(240, 120, 43, 0.25);">{{ $code }}</span>
                  </div>

                  <!-- Expiry badge -->
                  <div style="margin-top: 16px;">
                    <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 600; color: #fbbf24;">
                      ⏱️ Code expires in {{ $ttl ?? 10 }} minutes
                    </span>
                  </div>

                </td>
              </tr>
            </table>

            <!-- Security & Advice Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 12px;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="24" valign="top" style="padding-right: 12px; font-size: 16px; line-height: 22px;">🔒</td>
                      <td valign="top" style="font-size: 13px; line-height: 20px; color: #9da4b4;">
                        <strong style="color: #e2e8f0;">Security tip:</strong> Never share this code with anyone. Cineora staff will never contact you asking for your verification code.
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" height="10" style="height: 10px;"></td>
                    </tr>
                    <tr>
                      <td width="24" valign="top" style="padding-right: 12px; font-size: 16px; line-height: 22px;">🛡️</td>
                      <td valign="top" style="font-size: 13px; line-height: 20px; color: #9da4b4;">
                        <strong style="color: #e2e8f0;">Didn't request this?</strong> If you did not create an account or request this verification, you can safely ignore this email. No changes will occur.
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
              This is an automated security email. Please do not reply directly to this message.
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
