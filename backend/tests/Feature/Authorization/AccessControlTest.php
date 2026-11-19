<?php

namespace Tests\Feature\Authorization;

use App\Enums\BookingStatus;
use App\Enums\Permission;
use App\Enums\Role;
use App\Models\AccessPermission;
use App\Models\AccessRole;
use App\Models\Booking;
use App\Models\Cinema;
use App\Models\Payment;
use App\Models\Showtime;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    private function staff(Role $role, Cinema ...$cinemas): User
    {
        $factory = User::factory()->withRole($role);
        if ($cinemas) {
            $factory = $factory->assignedTo(...$cinemas);
        }

        return $factory->create();
    }

    public function test_seeder_is_idempotent_and_matches_the_enums(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $this->assertSame(count(Permission::cases()), AccessPermission::count());
        $this->assertSame(count(Role::cases()), AccessRole::count());
        $verifier = AccessRole::where('key', 'payment_verifier')->first();
        $this->assertEqualsCanonicalizing(
            array_map(fn ($p) => $p->value, Role::PaymentVerifier->permissions()),
            $verifier->permissions()->pluck('key')->all(),
        );
        $this->assertSame(0, User::count(), 'Seeding must not create accounts.');
    }

    public function test_payment_verifier_cannot_edit_prices_or_layouts_and_checker_cannot_see_payments(): void
    {
        $cinema = Cinema::factory()->create();
        $verifier = $this->staff(Role::PaymentVerifier, $cinema);
        $checker = $this->staff(Role::TicketChecker, $cinema);

        $this->assertFalse($verifier->hasPermission(Permission::PricesManage));
        $this->assertFalse($verifier->hasPermission(Permission::RoomsManage));
        $this->assertTrue($verifier->hasPermission(Permission::PaymentsVerify));
        $this->assertFalse($checker->hasPermission(Permission::PaymentsView));
        $this->assertFalse($checker->hasPermission(Permission::BookingsViewCustomer));
        $this->assertFalse($checker->hasPermission(Permission::RefundsDecide));
    }

    public function test_cinema_manager_is_limited_to_assigned_cinemas(): void
    {
        $mine = Cinema::factory()->create();
        $other = Cinema::factory()->create();
        $manager = $this->staff(Role::CinemaManager, $mine);

        $this->assertTrue(Gate::forUser($manager)->allows('update', $mine));
        $this->assertFalse(Gate::forUser($manager)->allows('update', $other));
        $this->assertFalse(Gate::forUser($manager)->allows('create', Cinema::class));

        $ownShowtime = Showtime::factory()->create(['cinema_id' => $mine->id]);
        $otherShowtime = Showtime::factory()->create(['cinema_id' => $other->id]);
        $this->assertTrue(Gate::forUser($manager)->allows('update', $ownShowtime));
        $this->assertFalse(Gate::forUser($manager)->allows('update', $otherShowtime));
        $this->assertFalse(Gate::forUser($manager)->allows('managePrices', $otherShowtime));
    }

    public function test_cinema_manager_cannot_verify_payments_without_the_permission(): void
    {
        $cinema = Cinema::factory()->create();
        $manager = $this->staff(Role::CinemaManager, $cinema);
        $payment = $this->paymentFor($cinema);

        $this->assertFalse(Gate::forUser($manager)->allows('review', $payment));
    }

    public function test_verifier_scope_self_approval_and_cross_cinema_rules(): void
    {
        $cinema = Cinema::factory()->create();
        $other = Cinema::factory()->create();
        $payment = $this->paymentFor($cinema);

        $verifier = $this->staff(Role::PaymentVerifier, $cinema);
        $wrongCinema = $this->staff(Role::PaymentVerifier, $other);

        $this->assertTrue(Gate::forUser($verifier)->allows('review', $payment));
        $this->assertFalse(Gate::forUser($wrongCinema)->allows('review', $payment));

        // Verifier who submitted the proof, or who owns the booking, may not approve it.
        $payment->update(['submitted_by' => $verifier->id]);
        $this->assertFalse(Gate::forUser($verifier->fresh())->allows('review', $payment->fresh()));

        $payment->update(['submitted_by' => null]);
        $payment->booking->update(['user_id' => $verifier->id]);
        $this->assertFalse(Gate::forUser($verifier->fresh())->allows('review', $payment->fresh()));
    }

    public function test_customer_cannot_view_another_customers_booking_or_payment(): void
    {
        $booking = Booking::factory()->create();
        $stranger = User::factory()->create();
        $payment = Payment::factory()->create(['booking_id' => $booking->id]);

        $this->assertTrue(Gate::forUser($booking->user)->allows('view', $booking));
        $this->assertFalse(Gate::forUser($stranger)->allows('view', $booking));
        $this->assertFalse(Gate::forUser($stranger)->allows('cancel', $booking));
        $this->assertFalse(Gate::forUser($stranger)->allows('view', $payment));
        $this->assertTrue(Gate::forUser($booking->user)->allows('submitProof', $payment));
        $this->assertFalse(Gate::forUser($stranger)->allows('submitProof', $payment));
    }

    public function test_ticket_checker_is_limited_to_assigned_cinema_and_sees_no_customer_details(): void
    {
        $mine = Cinema::factory()->create();
        $other = Cinema::factory()->create();
        $checker = $this->staff(Role::TicketChecker, $mine);

        $this->assertTrue(Gate::forUser($checker)->allows('validate', [\App\Models\Ticket::class, Showtime::factory()->create(['cinema_id' => $mine->id])]));
        $this->assertFalse(Gate::forUser($checker)->allows('validate', [\App\Models\Ticket::class, Showtime::factory()->create(['cinema_id' => $other->id])]));

        $booking = Booking::factory()->create(['cinema_id' => $mine->id]);
        $this->assertFalse(Gate::forUser($checker)->allows('viewCustomer', $booking));
        $this->assertFalse(Gate::forUser($checker)->allows('view', $booking));
    }

    public function test_inactive_staff_lose_all_access(): void
    {
        $cinema = Cinema::factory()->create();
        $verifier = User::factory()->withRole(Role::PaymentVerifier)->assignedTo($cinema)->inactive()->create();

        $this->assertFalse($verifier->hasPermission(Permission::PaymentsVerify));
        $this->assertFalse($verifier->isStaff());
    }

    public function test_users_with_no_roles_have_no_permissions(): void
    {
        $this->assertSame([], User::factory()->create()->permissionKeys()->all());
    }

    public function test_privilege_escalation_is_blocked(): void
    {
        $super = $this->staff(Role::SuperAdmin);
        $target = User::factory()->create();

        // Only a super admin can mint a super admin.
        $this->assertTrue(Gate::forUser($super)->allows('assignRole', [$target, Role::SuperAdmin]));

        // Cinema managers have no staff.manage at all.
        $manager = $this->staff(Role::CinemaManager);
        $this->assertFalse(Gate::forUser($manager)->allows('assignRole', [$target, Role::TicketChecker]));

        // A staff manager who lacks the permissions of a role cannot grant it, nor touch super admins.
        $custom = AccessRole::create(['key' => 'staff_lead', 'name' => 'Staff Lead']);
        $custom->permissions()->sync(AccessPermission::where('key', Permission::StaffManage->value)->pluck('id'));
        $lead = User::factory()->create();
        $lead->roles()->attach($custom->id);
        $this->assertFalse(Gate::forUser($lead)->allows('assignRole', [$target, Role::SuperAdmin]));
        $this->assertFalse(Gate::forUser($lead)->allows('assignRole', [$target, Role::PaymentVerifier]));
        $this->assertFalse(Gate::forUser($lead)->allows('assignRole', [$super, Role::TicketChecker]));
    }

    public function test_last_active_super_admin_cannot_be_deactivated(): void
    {
        $only = $this->staff(Role::SuperAdmin);
        $this->assertTrue($only->isLastActiveSuperAdmin());
        $this->assertFalse(Gate::forUser($only)->allows('deactivate', $only));

        $second = $this->staff(Role::SuperAdmin);
        $this->assertFalse($only->fresh()->isLastActiveSuperAdmin());
        $this->assertTrue(Gate::forUser($second)->allows('deactivate', $only->fresh()));
    }

    public function test_mass_assignment_cannot_set_privileged_user_fields(): void
    {
        $user = User::create([
            'name' => 'Mallory', 'email' => 'm@example.test', 'password' => 'x',
            'is_active' => false, 'mfa_confirmed_at' => now(), 'email_verified_at' => now(), 'id' => 999, 'public_id' => 'FORGED',
        ]);

        $this->assertTrue($user->fresh()->is_active);
        $this->assertNull($user->fresh()->mfa_confirmed_at);
        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertNotSame(999, $user->id);
        $this->assertNotSame('FORGED', $user->public_id);
    }

    public function test_booking_status_machine_blocks_arbitrary_transitions(): void
    {
        $this->assertTrue(BookingStatus::PENDING_PAYMENT->canTransitionTo(BookingStatus::PAYMENT_REVIEW));
        $this->assertFalse(BookingStatus::PENDING_PAYMENT->canTransitionTo(BookingStatus::CONFIRMED));
        $this->assertFalse(BookingStatus::EXPIRED->canTransitionTo(BookingStatus::CONFIRMED));
        $this->assertFalse(BookingStatus::CANCELLED->canTransitionTo(BookingStatus::PENDING_PAYMENT));
        $this->assertFalse(BookingStatus::PAYMENT_REJECTED->canTransitionTo(BookingStatus::CONFIRMED));
        $this->assertTrue(BookingStatus::PAYMENT_EXCEPTION->canTransitionTo(BookingStatus::CONFIRMED));
        $this->assertSame([], BookingStatus::REFUNDED->allowedTransitions());
        foreach (BookingStatus::cases() as $s) {
            $this->assertFalse($s->canTransitionTo($s), "{$s->value} must not transition to itself");
        }
    }

    private function paymentFor(Cinema $cinema): Payment
    {
        $showtime = Showtime::factory()->create(['cinema_id' => $cinema->id]);

        return Payment::factory()->create([
            'booking_id' => Booking::factory()->create(['showtime_id' => $showtime->id])->id,
        ]);
    }
}
