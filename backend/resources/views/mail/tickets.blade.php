<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Your tickets</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#18181b;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold;">{{ config('app.name') }}</td></tr>
    <tr><td style="padding:24px;">
        <h1 style="margin:0 0 8px;font-size:22px;">Your tickets are ready</h1>
        <p style="margin:0 0 16px;color:#52525b;">Payment confirmed for booking <strong>{{ $booking->reference }}</strong>. Show a QR code at the entrance, one per seat.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;">
            <tr><td style="padding:4px 0;color:#71717a;width:90px;">Movie</td><td style="padding:4px 0;font-weight:bold;">{{ $movie }}</td></tr>
            <tr><td style="padding:4px 0;color:#71717a;">When</td><td style="padding:4px 0;">{{ $startsAt }}</td></tr>
            <tr><td style="padding:4px 0;color:#71717a;">Where</td><td style="padding:4px 0;">{{ $cinema }} · {{ $room }}</td></tr>
        </table>
        @foreach ($tickets as $ticket)
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed #d4d4d8;border-radius:8px;margin-bottom:12px;">
            <tr><td align="center" style="padding:16px;">
                <img src="{{ $message->embedData($ticket['png'], 'ticket-'.$ticket['reference'].'.png', 'image/png') }}" width="200" height="200" alt="QR code for seat {{ $ticket['seat'] }}" style="display:block;">
                <p style="margin:10px 0 0;font-size:18px;font-weight:bold;">Seat {{ $ticket['seat'] }}</p>
                <p style="margin:2px 0 0;font-size:13px;color:#71717a;">{{ $ticket['category'] }} · Ticket {{ $ticket['reference'] }}</p>
            </td></tr>
        </table>
        @endforeach
        <p style="margin:20px 0 0;text-align:center;">
            <a href="{{ $ticketsUrl }}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">Open my tickets</a>
        </p>
        <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Keep this email private: anyone with a QR code can use that seat once.</p>
    </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
