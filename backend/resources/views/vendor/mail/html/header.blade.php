@props(['url'])
<tr>
<td class="header" align="center" style="padding: 32px 0 20px 0;">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr>
        <td align="center" valign="middle" width="40" height="40" style="width: 40px; height: 40px; background: linear-gradient(135deg, #e96f25 0%, #f0782b 100%); border-radius: 10px; text-align: center; color: #ffffff; font-size: 20px; font-weight: bold; box-shadow: 0 4px 14px rgba(240, 120, 43, 0.4);">
            🎬
        </td>
        <td style="padding-left: 12px; text-align: left;">
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase; display: block; line-height: 22px;">{{ config('app.name', 'Cineora') }}</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #f0782b; text-transform: uppercase; display: block; line-height: 12px; margin-top: 2px;">PREMIUM CINEMA</span>
        </td>
    </tr>
</table>
</a>
</td>
</tr>
