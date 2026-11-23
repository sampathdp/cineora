<?php

namespace Tests\Unit;

use App\Models\User;
use App\Notifications\AccountExistsNotification;
use App\Notifications\EmailOtpNotification;
use App\Services\Auth\EmailOtpService;
use Tests\TestCase;

class EmailNotificationTest extends TestCase
{
    public function test_email_otp_notification_builds_valid_mail_message(): void
    {
        $code = '477077';
        $notification = new EmailOtpNotification($code);
        $user = new User(['name' => 'Sampath', 'email' => 'sampath@example.test']);

        $mailMessage = $notification->toMail($user);

        // Public property remains accessible
        $this->assertSame($code, $notification->code);

        // Subject contains the OTP code and app name
        $this->assertStringContainsString($code, $mailMessage->subject);
        $this->assertStringContainsString((string) config('app.name'), $mailMessage->subject);

        // Lines are populated for backward compatibility
        $this->assertCount(3, $mailMessage->introLines);
        $this->assertStringContainsString($code, $mailMessage->introLines[1]);

        // HTML rendering succeeds and contains key elements
        $html = $mailMessage->render();
        $this->assertStringContainsString($code, $html);
        $this->assertStringContainsString('Sampath', $html);
        $this->assertStringContainsString('digit-cell', $html);
        $this->assertStringContainsString((string) EmailOtpService::TTL_MINUTES, $html);
    }

    public function test_account_exists_notification_builds_valid_mail_message(): void
    {
        $notification = new AccountExistsNotification();
        $user = new User(['name' => 'Jane', 'email' => 'jane@example.test']);

        $mailMessage = $notification->toMail($user);

        $this->assertSame('Someone tried to register with your email', $mailMessage->subject);
        $this->assertSame('Sign in', $mailMessage->actionText);

        $html = $mailMessage->render();
        $this->assertStringContainsString('Account Already Exists', $html);
        $this->assertStringContainsString('/login', $html);
    }
}
