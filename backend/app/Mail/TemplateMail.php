<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Plain transactional email: a subject, a few lines and an optional button. */
class TemplateMail extends Mailable
{
    /** @param  list<string>  $lines */
    public function __construct(private readonly string $mailSubject, private readonly array $lines, private readonly ?string $actionLabel = null, private readonly ?string $actionUrl = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->mailSubject);
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.template', with: ['lines' => $this->lines, 'actionLabel' => $this->actionLabel, 'actionUrl' => $this->actionUrl]);
    }
}
