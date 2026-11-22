<?php

return [
    'currency' => env('CINEORA_CURRENCY', 'KRW'),
    'timezone' => env('CINEORA_TIMEZONE', 'Asia/Seoul'),

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    'auth' => [
        // Staff must enrol TOTP MFA before using admin routes. Default: on in production.
        'require_staff_mfa' => (bool) env('REQUIRE_STAFF_MFA', env('APP_ENV') === 'production'),
    ],

    'showtime' => [
        // Cleaning/turnaround time added after the film when checking for room conflicts.
        'buffer_minutes' => (int) env('SHOWTIME_BUFFER_MINUTES', 20),
        'max_days_ahead' => (int) env('SHOWTIME_MAX_DAYS_AHEAD', 180),
        'max_price' => 1000000, // whole KRW per seat
    ],

    'limits' => [
        // Proof uploads per customer per minute.
        'proof_per_minute' => (int) env('PROOF_RATE_LIMIT', 5),
        // Contact form and newsletter sign-ups per IP per hour.
        'contact_per_hour' => (int) env('CONTACT_RATE_LIMIT', 8),
    ],

    'refund' => [
        // Staff may file a refund for a confirmed booking (on the customer's behalf) until this many hours before the show.
        'cutoff_hours' => (int) env('REFUND_CUTOFF_HOURS', 48),
    ],

    'ticket' => [
        // Check-in opens this long before the show and closes when the film ends.
        'checkin_opens_minutes_before' => (int) env('TICKET_CHECKIN_OPENS_MINUTES', 120),
    ],

    'booking' => [
        // Minutes a seat selection is protected while the customer reaches the payment step.
        'seat_hold_minutes' => (int) env('BOOKING_SEAT_HOLD_MINUTES', 120),
        // Minutes from booking creation until a bank transfer must be submitted.
        'payment_deadline_minutes' => (int) env('BOOKING_PAYMENT_DEADLINE_MINUTES', 120),
        'max_seats_per_booking' => (int) env('BOOKING_MAX_SEATS', 8),
        'max_active_unpaid_bookings' => (int) env('BOOKING_MAX_UNPAID', 1),
        // Whole won per seat; 0 disables the service fee.
        'service_fee_per_seat' => (int) env('BOOKING_SERVICE_FEE_PER_SEAT', 0),
    ],
];
