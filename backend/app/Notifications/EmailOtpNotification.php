<?php

namespace App\Notifications;

use App\Services\Auth\EmailOtpService;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Carries the six-digit email verification code. */
class EmailOtpNotification extends Notification
{
    public function __construct(public readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->code} is your ".config('app.name').' verification code')
            ->line('Use this code to verify your email address:')
            ->line("**{$this->code}**")
            ->line('The code expires in '.EmailOtpService::TTL_MINUTES.' minutes. If you did not create an account, you can ignore this email.');
    }
}
