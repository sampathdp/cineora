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
        $name = isset($notifiable->name) ? (string) $notifiable->name : null;
        $email = isset($notifiable->email) ? (string) $notifiable->email : null;
        $ttl = EmailOtpService::TTL_MINUTES;
        $appName = (string) config('app.name', 'Cineora');
        $frontendUrl = rtrim((string) config('cineora.frontend_url', config('app.url', 'http://localhost:3000')), '/');

        return (new MailMessage)
            ->subject("{$this->code} is your {$appName} verification code")
            ->line('Use this code to verify your email address:')
            ->line("**{$this->code}**")
            ->line("The code expires in {$ttl} minutes. If you did not create an account, you can ignore this email.")
            ->view('mail.otp', [
                'code' => $this->code,
                'ttl' => $ttl,
                'name' => $name,
                'email' => $email,
                'appName' => $appName,
                'frontendUrl' => $frontendUrl,
            ])
            ->text('mail.otp-text', [
                'code' => $this->code,
                'ttl' => $ttl,
                'name' => $name,
                'email' => $email,
                'appName' => $appName,
                'frontendUrl' => $frontendUrl,
            ]);
    }
}
