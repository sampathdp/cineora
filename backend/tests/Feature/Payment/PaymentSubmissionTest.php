<?php

namespace Tests\Feature\Payment;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\Booking;
use App\Models\OutboxMessage;
use App\Models\Payment;
use App\Models\PaymentProof;
use App\Models\ShowtimeSeat;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class PaymentSubmissionTest extends PaymentTestCase
{
    public function test_customer_sees_bank_instructions_for_their_own_booking_only(): void
    {
        $booking = $this->reserve();

        $r = $this->as($this->customer)->getJson("/api/v1/bookings/{$booking->public_id}/payment")->assertOk();
        $this->assertSame('110-123-456789', $r->json('data.bank.account_number'));
        $this->assertSame($booking->reference, $r->json('data.transfer_memo'));
        $this->assertSame(24000, $r->json('data.expected_amount'));
        $this->assertSame('AWAITING_TRANSFER', $r->json('data.status'));

        $this->getJson("/api/v1/bookings/{$booking->public_id}/payment")->assertOk();
        $this->assertSame(1, Payment::where('booking_id', $booking->id)->count(), 'asking twice must not create two payments');

        $this->as($this->customer())->getJson("/api/v1/bookings/{$booking->public_id}/payment")->assertNotFound();
        $this->assertStringNotContainsString('110-123', (string) \DB::table('bank_accounts')->value('account_number'), 'account number is encrypted at rest');
    }

    public function test_bank_account_for_the_cinema_wins_over_the_global_one_and_missing_accounts_are_reported(): void
    {
        $specific = BankAccount::factory()->create(['cinema_id' => $this->cinema->id, 'bank_name' => 'Cinema Bank']);
        $booking = $this->reserve();
        $this->as($this->customer)->getJson("/api/v1/bookings/{$booking->public_id}/payment")->assertJsonPath('data.bank.bank_name', 'Cinema Bank');

        BankAccount::query()->update(['is_active' => false]);
        $other = $this->reserve($this->customer(), ['B1']);
        $this->as($other->user)->getJson("/api/v1/bookings/{$other->public_id}/payment")->assertStatus(409)->assertJson(['code' => 'payment_unavailable']);
        $this->assertNotNull($specific);
    }

    public function test_valid_proof_moves_the_booking_into_review_and_stores_the_file_privately(): void
    {
        $booking = $this->reserve();
        $r = $this->submit($booking)->assertCreated();

        $this->assertSame(BookingStatus::PAYMENT_REVIEW, $booking->fresh()->status);
        $payment = Payment::where('booking_id', $booking->id)->firstOrFail();
        $this->assertSame(PaymentStatus::PROOF_SUBMITTED, $payment->status);
        $this->assertSame($this->customer->id, $payment->submitted_by);
        $this->assertSame(24000, (int) $payment->submitted_amount);

        $proof = PaymentProof::firstOrFail();
        $this->assertSame('private', $proof->disk);
        $this->assertMatchesRegularExpression('#^payment-proofs/\d{4}/\d{2}/[0-9a-z]{26}\.webp$#', $proof->path);
        Storage::disk('private')->assertExists($proof->path);
        $this->assertSame([], Storage::disk('public')->allFiles(), 'proofs never touch the public disk');
        $this->assertSame(64, strlen($proof->sha256));

        // The response never exposes storage paths.
        $this->assertStringNotContainsString($proof->path, $r->getContent());
        $this->assertStringNotContainsString('payment-proofs', $r->getContent());

        // Seats stay protected up to the original payment deadline, not beyond.
        $deadline = $booking->fresh()->payment_deadline_at;
        $this->assertTrue($booking->fresh()->hold_expires_at->equalTo($deadline));
        $this->assertSame(2, ShowtimeSeat::where('booking_id', $booking->id)->where('status', 'held')->where('hold_expires_at', $deadline)->count());

        $this->assertSame(1, OutboxMessage::where('type', 'payment.proof_received')->count());
        $this->assertSame(1, AuditLog::where('action', 'payment.proof_submitted')->count());
        $this->assertSame(['PENDING_PAYMENT', 'PAYMENT_REVIEW'], $booking->histories()->orderBy('id')->pluck('to_status')->all());
    }

    public function test_pdf_proofs_are_accepted_but_active_content_is_not(): void
    {
        $b = $this->reserve($this->customer, ['A1']);
        $this->submit($b, null, [], UploadedFile::fake()->createWithContent('slip.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"))->assertCreated();
        $this->assertSame('application/pdf', PaymentProof::firstOrFail()->mime);

        foreach (['/JavaScript', '/JS', '/OpenAction', '/Launch', '/EmbeddedFile'] as $i => $marker) {
            $other = $this->reserve($this->customer(), [['A2', 'A3', 'A4', 'B1', 'B2'][$i]]);
            $bad = UploadedFile::fake()->createWithContent('evil.pdf', "%PDF-1.4\n1 0 obj<< {$marker} (app.alert(1)) >>endobj\n%%EOF");
            $this->submit($other, $other->user, [], $bad)->assertStatus(422)->assertJsonValidationErrors('proof');
        }
        $this->assertSame(1, PaymentProof::count());
    }

    public function test_dangerous_or_wrong_files_are_rejected_and_nothing_is_stored(): void
    {
        $booking = $this->reserve();
        $bad = [
            'php as png' => UploadedFile::fake()->createWithContent('shell.png', '<?php system($_GET["c"]); ?>'),
            'html as jpg' => UploadedFile::fake()->createWithContent('page.jpg', '<html><script>alert(1)</script></html>'),
            'svg' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
            'exe' => UploadedFile::fake()->createWithContent('run.pdf', "MZ\x90\x00\x03"),
            'not a pdf' => UploadedFile::fake()->createWithContent('doc.pdf', 'hello world'),
            'zip' => UploadedFile::fake()->createWithContent('a.png', "PK\x03\x04junk"),
            'empty' => UploadedFile::fake()->createWithContent('empty.png', ''),
            'huge' => UploadedFile::fake()->create('big.png', 6000, 'image/png'),
        ];
        foreach ($bad as $label => $file) {
            $this->submit($booking, null, [], $file)->assertStatus(422);
            $this->assertSame(BookingStatus::PENDING_PAYMENT, $booking->fresh()->status, "$label must not move the booking");
        }
        $this->assertSame([], Storage::disk('private')->allFiles());
        $this->assertSame(0, PaymentProof::count());
    }

    public function test_appended_payload_does_not_survive_re_encoding(): void
    {
        $booking = $this->reserve();
        $file = $this->png();
        file_put_contents($file->getRealPath(), '<?php echo "pwned"; ?>', FILE_APPEND);

        $this->submit($booking, null, [], $file)->assertCreated();

        $stored = Storage::disk('private')->get(PaymentProof::firstOrFail()->path);
        $this->assertStringNotContainsString('<?php', $stored);
    }

    public function test_field_validation(): void
    {
        $booking = $this->reserve();
        foreach ([
            'amount zero' => ['submitted_amount' => 0],
            'amount negative' => ['submitted_amount' => -5],
            'amount fractional' => ['submitted_amount' => '24000.5'],
            'amount text' => ['submitted_amount' => 'abc'],
            'amount huge' => ['submitted_amount' => 999999999999],
            'date format' => ['transfer_date' => '01/02/2026'],
            'date future' => ['transfer_date' => now()->addDays(5)->toDateString()],
            'date before booking' => ['transfer_date' => now()->subDays(10)->toDateString()],
            'payer too long' => ['payer_name' => str_repeat('x', 200)],
        ] as $label => $over) {
            $this->submit($booking, null, $over)->assertStatus(422);
            $this->assertSame(BookingStatus::PENDING_PAYMENT, $booking->fresh()->status, $label);
        }
        $r = $this->as($this->customer)->post("/api/v1/bookings/{$booking->public_id}/payment/proof", ['submitted_amount' => 24000, 'transfer_date' => now()->toDateString()], ['Accept' => 'application/json']);
        $r->assertStatus(422)->assertJsonValidationErrors('proof');
    }

    public function test_cannot_submit_in_the_wrong_state_or_for_someone_elses_booking(): void
    {
        $booking = $this->reserve();
        $this->submit($booking, $this->customer)->assertCreated();
        $this->submit($booking, null, [], $this->png(2))->assertStatus(409)->assertJson(['code' => 'already_submitted']);

        $other = $this->reserve($this->customer(), ['B1']);
        $this->submit($other, $this->customer())->assertNotFound(); // a third customer
        $this->submit($other, $this->verifier)->assertNotFound();   // staff are not owners either
        $this->assertSame(BookingStatus::PENDING_PAYMENT, $other->fresh()->status);

        foreach ([BookingStatus::CANCELLED, BookingStatus::EXPIRED, BookingStatus::CONFIRMED] as $i => $status) {
            $b = $this->reserve($this->customer(), [['A3', 'A4', 'B2'][$i]]);
            $b->forceFill(['status' => $status])->save();
            $this->submit($b, $b->user)->assertStatus(409)->assertJson(['code' => 'not_payable']);
        }
    }

    public function test_an_expired_hold_cannot_receive_a_proof_even_before_the_job_runs(): void
    {
        $booking = $this->reserve();
        Carbon::setTestNow(now()->addMinutes((int) config('cineora.booking.seat_hold_minutes') + 1));

        $this->submit($booking)->assertStatus(409)->assertJson(['code' => 'hold_expired']);
        $this->assertSame(0, PaymentProof::count());
        Carbon::setTestNow();
    }

    public function test_lost_seats_block_submission(): void
    {
        $booking = $this->reserve();
        ShowtimeSeat::where('booking_id', $booking->id)->limit(1)->update(['booking_id' => null, 'status' => 'available']);

        $this->submit($booking)->assertStatus(409)->assertJson(['code' => 'seats_lost']);
    }

    public function test_the_same_proof_file_cannot_back_two_different_bookings(): void
    {
        $first = $this->reserve($this->customer, ['A1']);
        $second = $this->reserve($this->customer(), ['A2']);
        $this->submit($first, $first->user, [], $this->png(7))->assertCreated();

        $this->submit($second, $second->user, [], $this->png(7))->assertStatus(422)->assertJsonValidationErrors('proof');
        $this->assertSame(1, PaymentProof::count());
        $this->assertCount(1, Storage::disk('private')->allFiles(), 'the rejected duplicate leaves no orphan file');
        $this->submit($second, $second->user, [], $this->png(8))->assertCreated();
    }

    public function test_rate_limit_on_uploads(): void
    {
        config(['cineora.limits.proof_per_minute' => 5]);
        $booking = $this->reserve();
        for ($i = 0; $i < 5; $i++) {
            $this->submit($booking, null, ['submitted_amount' => 0]); // each is a 422 but counts
        }
        $this->submit($booking)->assertStatus(429);
    }

    public function test_proof_files_are_served_only_to_the_owner_and_authorised_staff(): void
    {
        [$booking, $payment] = $this->inReview();
        $proof = $payment->proofs()->first();
        $own = "/api/v1/bookings/{$booking->public_id}/payment/proofs/{$proof->id}";
        $staff = "/api/v1/admin/payments/{$payment->public_id}/proofs/{$proof->id}";

        $r = $this->as($this->customer)->get($own)->assertOk();
        $this->assertSame('image/webp', $r->headers->get('Content-Type'));
        $this->assertSame('nosniff', $r->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('no-store', $r->headers->get('Cache-Control'));
        $this->assertStringContainsString('sandbox', $r->headers->get('Content-Security-Policy'));

        $this->as($this->customer())->get($own)->assertNotFound();
        $this->as($this->customer)->get("/api/v1/bookings/{$booking->public_id}/payment/proofs/999999")->assertNotFound();

        $this->as($this->verifier)->get($staff)->assertOk();
        $this->assertSame(1, AuditLog::where('action', 'payment.proof_viewed')->where('actor_id', $this->verifier->id)->count());

        // Other cinema's verifier, a checker, a cinema manager without payment rights and a customer are all refused.
        $elsewhere = $this->staff(\App\Enums\Role::PaymentVerifier);
        $elsewhere->cinemas()->attach(\App\Models\Cinema::factory()->create());
        $elsewhere->flushAccessCache();
        $this->as($elsewhere)->get($staff)->assertForbidden();
        $this->as($this->staff(\App\Enums\Role::TicketChecker))->get($staff)->assertForbidden();
        $this->as($this->staff(\App\Enums\Role::CinemaManager))->get($staff)->assertForbidden();
        $this->as($this->customer)->get($staff)->assertForbidden();

        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->get($staff, ['Accept' => 'application/json'])->assertUnauthorized();
        $this->get($own, ['Accept' => 'application/json'])->assertUnauthorized();
    }

    public function test_every_payment_endpoint_requires_login(): void
    {
        $booking = $this->reserve();
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();

        $this->getJson("/api/v1/bookings/{$booking->public_id}/payment")->assertUnauthorized();
        $this->postJson("/api/v1/bookings/{$booking->public_id}/payment/proof")->assertUnauthorized();
        $this->getJson('/api/v1/admin/payments')->assertUnauthorized();
        $this->postJson('/api/v1/admin/payments/'.str_repeat('0', 26).'/verify')->assertUnauthorized();
        $this->assertSame(0, Booking::where('status', 'CONFIRMED')->count());
    }
}
