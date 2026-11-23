<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your tickets are ready - {{ config('app.name', 'Cineora') }}</title>
<!--[if mso]>
<style type="text/css">
body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
</style>
<![endif]-->
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; margin: 0 auto !important; border-radius: 0 !important; }
    .email-content { padding: 24px 20px !important; }
    .ticket-card { width: 100% !important; }
    .btn-block { width: 100% !important; display: block !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #08090d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #f7f7f5;">

<!-- Preheader preview text -->
<div style="display: none; font-size: 1px; color: #08090d; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
  Your tickets for {{ $movie }} are ready! Booking reference: {{ $booking->reference }}.
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
                  <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; display: block; line-height: 24px;">{{ config('app.name', 'Cineora') }}</span>
                  <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #f0782b; text-transform: uppercase; display: block; line-height: 12px; margin-top: 3px;">PREMIUM CINEMA EXPERIENCE</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Email Body Content -->
        <tr>
          <td class="email-content" style="padding: 36px 36px 32px 36px; background-color: #12141a;">
            
            <!-- Confirmed Pill -->
            <div style="text-align: center; margin-bottom: 16px;">
              <span style="display: inline-block; background-color: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 20px; padding: 5px 14px; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #4ade80;">
                ✓ BOOKING CONFIRMED
              </span>
            </div>

            <!-- Heading -->
            <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 800; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
              Your Tickets Are Ready
            </h1>

            <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #9da4b4; text-align: center;">
              Payment confirmed for booking <strong style="color: #ff9a58; font-family: monospace; letter-spacing: 1px;">{{ $booking->reference }}</strong>. Show a QR code at the entrance, one per seat.
            </p>

            <!-- Showtime Info Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b0d12; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; margin-bottom: 28px; padding: 18px 20px;">
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #71717a; width: 75px; font-size: 13px;">Movie</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #ffffff; font-size: 16px;">{{ $movie }}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a; font-size: 13px;">When</td>
                      <td style="padding: 6px 0; color: #e4e4e7; font-weight: 500;">{{ $startsAt }}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a; font-size: 13px;">Where</td>
                      <td style="padding: 6px 0; color: #e4e4e7; font-weight: 500;">{{ $cinema }} &middot; {{ $room }}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Tickets List -->
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #8e95a5; margin-bottom: 16px; text-align: center;">
              DIGITAL ENTRANCE PASSES ({{ count($tickets) }})
            </div>

            @foreach ($tickets as $ticket)
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ticket-card" style="background-color: #171b24; border: 1.5px dashed rgba(240, 120, 43, 0.4); border-radius: 14px; margin-bottom: 20px; overflow: hidden;">
              <tr>
                <td align="center" style="padding: 24px 20px;">
                  
                  <!-- QR Code container with solid white background for optical scanning -->
                  <div style="background-color: #ffffff; padding: 12px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);">
                    <img src="{{ $message->embedData($ticket['png'], 'ticket-'.$ticket['reference'].'.png', 'image/png') }}" width="190" height="190" alt="QR code for seat {{ $ticket['seat'] }}" style="display: block; width: 190px; height: 190px;">
                  </div>

                  <!-- Seat Info Badge -->
                  <div style="margin-top: 18px;">
                    <span style="display: inline-block; background-color: rgba(240, 120, 43, 0.15); border: 1px solid rgba(240, 120, 43, 0.35); border-radius: 8px; padding: 4px 16px; font-size: 18px; font-weight: 800; color: #f0782b; letter-spacing: 0.5px;">
                      SEAT {{ $ticket['seat'] }}
                    </span>
                  </div>

                  <!-- Category & Ref -->
                  <p style="margin: 8px 0 0 0; font-size: 13px; color: #a1a1aa;">
                    {{ $ticket['category'] }} &middot; Ticket <strong style="color: #e4e4e7; font-family: monospace;">{{ $ticket['reference'] }}</strong>
                  </p>

                </td>
              </tr>
            </table>
            @endforeach

            <!-- Action Button -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 28px auto;">
              <tr>
                <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #e96f25 0%, #f0782b 100%); box-shadow: 0 4px 18px rgba(240, 120, 43, 0.4);">
                  <a href="{{ $ticketsUrl }}" class="btn-block" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;">
                    Open My Tickets Online &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Security notice -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 10px;">
              <tr>
                <td style="padding: 12px 16px; font-size: 12px; line-height: 18px; color: #8e95a5; text-align: center;">
                  🔒 <strong>Keep this email private:</strong> Anyone with a QR code can check into that seat once. Arrive 15 minutes before showtime.
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background-color: #0c0e14; padding: 28px 32px; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 18px; color: #64748b;">
              &copy; {{ date('Y') }} {{ config('app.name', 'Cineora') }}. All rights reserved.
            </p>
            <p style="margin: 0; font-size: 11px; line-height: 16px; color: #475569;">
              Thank you for choosing {{ config('app.name', 'Cineora') }}. Enjoy your movie!
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
