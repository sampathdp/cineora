Your tickets are ready

Payment confirmed for booking {{ $booking->reference }}.

Movie: {{ $movie }}
When: {{ $startsAt }}
Where: {{ $cinema }} · {{ $room }}

@foreach ($tickets as $ticket)
- Seat {{ $ticket['seat'] }} ({{ $ticket['category'] }}), ticket {{ $ticket['reference'] }}
@endforeach

Your QR codes are in the HTML version of this email and on your tickets page:
{{ $ticketsUrl }}

{{ config('app.name') }}
