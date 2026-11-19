<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\Cinema;
use App\Models\Ticket;
use Illuminate\Support\Carbon;

class ReportingTest extends AdminTestCase
{
    private function range(): string
    {
        return 'from='.now()->subDays(2)->toDateString().'&to='.now()->addDays(1)->toDateString();
    }

    public function test_dashboard_shows_real_scoped_numbers_and_rejects_unauthorised_roles(): void
    {
        $this->confirmed($this->customer, ['A1', 'A2']);               // 24,000 confirmed
        $this->reserve($this->customer(), ['B1']);                      // pending
        [, $payment] = $this->inReview($this->customer(), ['B2'], 5);   // waiting for review

        $d = $this->as($this->admin)->getJson('/api/v1/admin/dashboard')->assertOk()->json('data');
        $this->assertSame(3, $d['total_bookings']);
        $this->assertSame(3, $d['today_bookings']);
        $this->assertSame(1, $d['confirmed_bookings']);
        $this->assertSame(24000, $d['verified_revenue']);
        $this->assertSame(1, $d['pending_verification']);
        $this->assertSame(1, $d['upcoming_showtimes']);
        $this->assertSame(1, $d['cinemas']);
        $this->assertCount(30, $d['trend']);
        $this->assertSame(3, collect($d['trend'])->sum('bookings'));
        $this->assertSame(24000, collect($d['trend'])->sum('revenue'));
        $this->assertSame('KRW', $d['currency']);
        $this->assertNotNull($payment);

        $own = $this->as($this->manager())->getJson('/api/v1/admin/dashboard')->assertOk()->json('data');
        $this->assertSame(3, $own['total_bookings']);
        $other = $this->as($this->manager(Cinema::factory()->create()))->getJson('/api/v1/admin/dashboard')->assertOk()->json('data');
        $this->assertSame([0, 0, 0, 0], [$other['total_bookings'], $other['confirmed_bookings'], $other['verified_revenue'], $other['pending_verification']]);

        $this->as($this->customer)->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->as($this->checker)->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
    }

    public function test_dashboard_day_window_is_validated(): void
    {
        $this->as($this->admin)->getJson('/api/v1/admin/dashboard?days=7')->assertOk()->assertJsonCount(7, 'data.trend');
        $this->getJson('/api/v1/admin/dashboard?days=500')->assertStatus(422);
    }

    public function test_every_report_type_returns_columns_and_rows_with_correct_totals(): void
    {
        $booking = $this->confirmed($this->customer, ['A1', 'A2']);
        Ticket::where('booking_id', $booking->id)->first()->forceFill(['status' => 'used', 'used_at' => now()])->save();
        $this->as($this->admin);

        foreach (['bookings', 'revenue', 'cinema-performance', 'movie-performance', 'payments', 'checkins', 'cancellations'] as $type) {
            $r = $this->getJson("/api/v1/admin/reports/{$type}?".$this->range())->assertOk();
            $this->assertNotEmpty($r->json('data.columns'), $type);
            $this->assertIsArray($r->json('data.rows'), $type);
        }
        $rev = $this->getJson('/api/v1/admin/reports/revenue?'.$this->range())->json('data.rows');
        $this->assertSame([1, 24000], [$rev[0]['bookings'], $rev[0]['revenue']]);
        $perf = $this->getJson('/api/v1/admin/reports/cinema-performance?'.$this->range())->json('data.rows.0');
        $this->assertSame([2, 1, 12000], [$perf['tickets'], $perf['used'], $perf['avg_ticket']]);
        $movie = $this->getJson('/api/v1/admin/reports/movie-performance?'.$this->range())->json('data.rows.0');
        $this->assertSame([2, 24000], [$movie['tickets'], $movie['revenue']]);
        $pay = collect($this->getJson('/api/v1/admin/reports/payments?'.$this->range())->json('data.rows'))->firstWhere('status', 'VERIFIED');
        $this->assertSame(1, $pay['payments']);
        $this->assertSame(1, $this->getJson('/api/v1/admin/reports/checkins?'.$this->range())->json('data.rows.0.checkins'));
    }

    public function test_cancellation_report_counts_outcomes(): void
    {
        $b = $this->reserve($this->customer, ['A1']);
        $this->as($this->customer)->postJson("/api/v1/bookings/{$b->public_id}/cancel")->assertOk();

        $rows = $this->as($this->admin)->getJson('/api/v1/admin/reports/cancellations?'.$this->range())->json('data.rows');
        $this->assertSame(['CANCELLED', 1, 12000], [$rows[0]['status'], $rows[0]['bookings'], $rows[0]['amount']]);
    }

    public function test_reports_are_scoped_to_the_viewers_cinemas_and_cinema_filters_cannot_widen_that(): void
    {
        $this->confirmed();
        $elsewhere = Cinema::factory()->create();
        $outsider = $this->manager($elsewhere);

        $rows = $this->as($outsider)->getJson('/api/v1/admin/reports/revenue?'.$this->range())->assertOk()->json('data.rows');
        $this->assertSame([], $rows);
        $this->getJson('/api/v1/admin/reports/revenue?'.$this->range().'&cinema='.$this->cinema->public_id)->assertForbidden();
        $this->as($this->manager())->getJson('/api/v1/admin/reports/revenue?'.$this->range().'&cinema='.$this->cinema->public_id)->assertOk()->assertJsonCount(1, 'data.rows');
    }

    public function test_report_inputs_and_roles_are_validated(): void
    {
        $this->as($this->admin);
        $this->getJson('/api/v1/admin/reports/revenue')->assertStatus(422);
        $this->getJson('/api/v1/admin/reports/revenue?from=2026-01-01&to=2025-01-01')->assertStatus(422);
        $this->getJson('/api/v1/admin/reports/revenue?from=2024-01-01&to=2026-01-01')->assertStatus(422);
        $this->getJson('/api/v1/admin/reports/nonsense?'.$this->range())->assertNotFound();
        $this->getJson('/api/v1/admin/reports/revenue?'.$this->range().'&group=hour')->assertStatus(422);

        $this->as($this->verifier)->getJson('/api/v1/admin/reports/revenue?'.$this->range())->assertForbidden();
        $this->as($this->customer)->getJson('/api/v1/admin/reports')->assertForbidden();
        $this->as($this->admin)->getJson('/api/v1/admin/reports')->assertOk()->assertJsonCount(7, 'data');
    }

    public function test_csv_export_needs_its_own_permission_is_audited_and_neutralises_formulas(): void
    {
        $this->movie->update(['title' => '=HYPERLINK("http://evil.test","click")']);
        $this->confirmed();
        $q = '/api/v1/admin/reports/movie-performance?'.$this->range().'&format=csv';

        // A cinema manager may view reports but not export them.
        $this->as($this->manager())->getJson('/api/v1/admin/reports/movie-performance?'.$this->range())->assertOk()->assertJsonPath('meta.can_export', false);
        $this->get($q, ['Accept' => 'text/csv'])->assertForbidden();

        $r = $this->as($this->admin)->get($q)->assertOk();
        $this->assertStringContainsString('text/csv', $r->headers->get('Content-Type'));
        $csv = $r->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv, 'a leading = must be neutralised');
        $this->assertStringNotContainsString(",=HYPERLINK", str_replace('"', '', $csv));
        $this->assertStringNotContainsString($this->customer->email, $csv, 'reports hold no personal data');
        $this->assertSame(1, AuditLog::where('action', 'report.exported')->where('actor_id', $this->admin->id)->count());
    }

    public function test_monthly_grouping(): void
    {
        $this->confirmed();
        $rows = $this->as($this->admin)->getJson('/api/v1/admin/reports/bookings?'.$this->range().'&group=month')->json('data.rows');
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}$/', $rows[0]['period']);
        $this->assertSame(1, $rows[0]['confirmed']);
    }

    // --- Bookings and customers -----------------------------------------------------------------

    public function test_staff_booking_list_is_scoped_searchable_and_hides_customers_without_permission(): void
    {
        $booking = $this->reserve($this->customer, ['A1']);
        $elsewhere = $this->manager(Cinema::factory()->create());

        $verifierView = $this->as($this->verifier)->getJson('/api/v1/admin/bookings')->assertOk();
        $this->assertCount(1, $verifierView->json('data'));
        $this->assertNull($verifierView->json('data.0.customer'));
        $this->assertStringNotContainsString($this->customer->email, $verifierView->getContent());
        $this->getJson('/api/v1/admin/bookings?q='.urlencode(substr($this->customer->email, 0, 6)))->assertOk()->assertJsonCount(0, 'data'); // cannot search by email

        $this->assertSame([], $this->as($elsewhere)->getJson('/api/v1/admin/bookings')->json('data'));
        $this->getJson("/api/v1/admin/bookings/{$booking->public_id}")->assertForbidden();

        $all = $this->as($this->admin)->getJson('/api/v1/admin/bookings?q='.substr($booking->reference, 0, 6))->assertOk();
        $this->assertSame($this->customer->email, $all->json('data.0.customer.email'));
        $this->getJson('/api/v1/admin/bookings?q='.urlencode(substr($this->customer->email, 0, 6)))->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/bookings?status=PENDING_PAYMENT')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/bookings?status=CONFIRMED')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/bookings?status=BOGUS')->assertStatus(422);

        $detail = $this->getJson("/api/v1/admin/bookings/{$booking->public_id}")->assertOk()->json('data');
        $this->assertSame(['PENDING_PAYMENT'], array_column($detail['history'], 'to'));
        $this->as($this->customer)->getJson('/api/v1/admin/bookings')->assertForbidden();
    }

    public function test_staff_can_cancel_unpaid_bookings_but_not_paid_ones(): void
    {
        $unpaid = $this->reserve($this->customer, ['A1']);
        $paid = $this->confirmed($this->customer(), ['B1']);
        $manager = $this->manager();

        $this->as($manager)->postJson("/api/v1/admin/bookings/{$unpaid->public_id}/cancel")->assertOk();
        $this->assertSame(BookingStatus::CANCELLED, $unpaid->fresh()->status);
        $this->postJson("/api/v1/admin/bookings/{$paid->public_id}/cancel")->assertStatus(409)->assertJson(['code' => 'use_refund_workflow']);
        $this->assertSame(BookingStatus::CONFIRMED, $paid->fresh()->status);

        $other = $this->reserve($this->customer(), ['A2']);
        $this->as($this->manager(Cinema::factory()->create()))->postJson("/api/v1/admin/bookings/{$other->public_id}/cancel")->assertForbidden();
        $this->as($this->verifier)->postJson("/api/v1/admin/bookings/{$other->public_id}/cancel")->assertForbidden();
    }

    public function test_customer_directory_is_restricted_and_excludes_staff(): void
    {
        $this->reserve($this->customer, ['A1']);

        $this->as($this->verifier)->getJson('/api/v1/admin/customers')->assertForbidden();
        $this->as($this->manager())->getJson('/api/v1/admin/customers')->assertForbidden();

        $list = $this->as($this->admin)->getJson('/api/v1/admin/customers')->assertOk()->json('data');
        $emails = array_column($list, 'email');
        $this->assertContains($this->customer->email, $emails);
        $this->assertNotContains($this->verifier->email, $emails, 'staff are not customers');
        $this->assertArrayNotHasKey('password', $list[0]);

        $this->getJson("/api/v1/admin/customers/{$this->customer->public_id}")->assertOk()->assertJsonCount(1, 'data.recent_bookings');
        $this->getJson("/api/v1/admin/customers/{$this->verifier->public_id}")->assertNotFound();
        $this->assertSame(1, AuditLog::where('action', 'customer.viewed')->count());

        $scoped = $this->withPermissions(['customers.view'], Cinema::factory()->create());
        $this->as($scoped)->getJson('/api/v1/admin/customers')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/v1/admin/customers/{$this->customer->public_id}")->assertNotFound();
    }

    public function test_audit_log_is_read_only_filterable_and_free_of_secrets(): void
    {
        $this->as($this->admin)->postJson('/api/v1/admin/bank-accounts', ['bank_name' => 'Audit Bank', 'account_name' => 'X Ltd', 'account_number' => '555-444-333222'])->assertCreated();
        $this->confirmed();

        $all = $this->as($this->admin)->getJson('/api/v1/admin/audit-logs?per_page=100')->assertOk();
        $this->assertGreaterThan(5, $all->json('meta.total'));
        $this->assertStringNotContainsString('555-444-333222', $all->getContent());
        $this->assertStringNotContainsString('password', strtolower(json_encode(array_column($all->json('data'), 'metadata'))));

        $this->getJson('/api/v1/admin/audit-logs?action=bank_account')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/audit-logs?action=payment.verified')->assertJsonPath('data.0.actor.email', $this->verifier->email);
        $this->getJson('/api/v1/admin/audit-logs?actor='.urlencode($this->admin->email))->assertOk();
        $this->getJson('/api/v1/admin/audit-logs?from=bad')->assertStatus(422);

        // No write verbs exist for the audit trail.
        $this->postJson('/api/v1/admin/audit-logs', [])->assertStatus(405);
        $this->deleteJson('/api/v1/admin/audit-logs/1')->assertStatus(404);

        foreach ([$this->verifier, $this->manager(), $this->checker, $this->customer] as $user) {
            $this->as($user)->getJson('/api/v1/admin/audit-logs')->assertForbidden();
        }
    }
}
