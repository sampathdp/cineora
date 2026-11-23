<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent instead of a second verification email when someone registers an address that already has an account. */
class AccountExistsNotification extends Notification
{
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontend = rtrim((string) config('cineora.frontend_url', config('app.url', 'http://localhost:3000')), '/');
        $appName = (string) config('app.name', 'Cineora');
        $email = isset($notifiable->email) ? (string) $notifiable->email : null;
        $name = isset($notifiable->name) ? (string) $notifiable->name : null;

        return (new MailMessage)
            ->subject('Someone tried to register with your email')
            ->line('A registration was attempted with this email address, but an account already exists.')
            ->line('If this was you, sign in or reset your password. If not, you can ignore this email.')
            ->action('Sign in', $frontend.'/login')
            ->view('mail.account-exists', [
                'loginUrl' => $frontend.'/login',
                'forgotUrl' => $frontend.'/forgot-password',
                'frontendUrl' => $frontend,
                'appName' => $appName,
                'email' => $email,
                'name' => $name,
            ])
            ->text('mail.account-exists-text', [
                'loginUrl' => $frontend.'/login',
                'forgotUrl' => $frontend.'/forgot-password',
                'frontendUrl' => $frontend,
                'appName' => $appName,
                'email' => $email,
                'name' => $name,
            ]);
    }
}
