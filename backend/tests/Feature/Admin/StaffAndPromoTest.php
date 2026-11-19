<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\AccessRole;
use App\Models\AuditLog;
use App\Models\Cinema;
use App\Models\PromoCode;
use App\Models\PromoRedemption;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class StaffAndPromoTest extends AdminTestCase
{
    private function create(array $over = [])
    {
        return $this->postJson('/api/v1/admin/staff', array_merge(['name' => 'New Person', 'email' => 'new.person@example.test', 'roles' => ['ticket_checker'], 'cinemas' => [$this->cinema->public_id]], $over));
    }

    public function test_super_admin_creates_staff_who_must_set_their_own_password(): void
    {
        Notification::fake();
        $r = $this->as($this->admin)->postJson('/api/v1/admin/staff', ['name' => 'New Person', 'email' => 'New.Person@Example.test', 'roles' => ['ticket_checker'], 'cinemas' => [$this->cinema->public_id]])->assertCreated();

        $user = User::where('email', 'new.person@example.test')->firstOrFail();
        $this->assertSame(['ticket_checker'], $user->roleKeys()->all());
        $this->assertSame([$this->cinema->id], $user->cinemas()->pluck('cinemas.id')->all());
        $this->assertTrue($user->is_active);
        Notification::assertSentTo($user, ResetPassword::class);
        $this->assertArrayNotHasKey('password', $r->json('data'));
        $this->assertSame(1, AuditLog::where('action', 'staff.created')->count());

        // The random placeholder password is unusable: nobody knows it.
        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/staff/login', ['email' => 'new.person@example.test', 'password' => 'password'])->assertStatus(422);
    }

    public function test_staff_management_is_restricted_and_validated(): void
    {
        foreach ([$this->verifier, $this->manager(), $this->checker, $this->customer] as $user) {
            $this->as($user)->getJson('/api/v1/admin/staff')->assertForbidden();
            $this->postJson('/api/v1/admin/staff', ['name' => 'X Y', 'email' => 'x@example.test', 'roles' => ['ticket_checker']])->assertForbidden();
        }
        $this->as($this->admin);
        $this->create(['email' => $this->verifier->email])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->create(['roles' => ['nope']])->assertStatus(422);
        $this->create(['roles' => []])->assertStatus(422);
        $this->create(['roles' => ['customer', 'ticket_checker']])->assertStatus(422);
        $this->create(['cinemas' => ['01ARZ3NDEKTSV4RRFFQ69G5FAV']])->assertStatus(422);
        $this->assertSame(0, User::where('email', 'new.person@example.test')->count());
    }

    public function test_nobody_can_grant_more_than_they_hold(): void
    {
        $lead = $this->withPermissions(['staff.manage', 'payments.view', 'payments.verify', 'bookings.view', 'dashboard.view'], $this->cinema);

        $this->as($lead);
        $this->create(['email' => 'a@example.test', 'roles' => ['super_admin']])->assertStatus(409)->assertJson(['code' => 'privilege_escalation']);
        $this->create(['email' => 'b@example.test', 'roles' => ['cinema_manager']])->assertStatus(409); // has permissions the lead lacks
        $this->create(['email' => 'c@example.test', 'roles' => ['payment_verifier']])->assertCreated(); // subset of the lead's own permissions
        $this->assertSame(0, User::whereIn('email', ['a@example.test', 'b@example.test'])->count());

        // Editing someone else into a role they could not be given is refused too.
        $victim = User::where('email', 'c@example.test')->first();
        $this->patchJson("/api/v1/admin/staff/{$victim->public_id}", ['roles' => ['super_admin']])->assertStatus(409);
        $this->assertSame(['payment_verifier'], $victim->fresh()->roleKeys()->all());

        // A non-super admin can never touch a super admin.
        $this->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['roles' => ['payment_verifier']])->assertStatus(409);
        $this->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['is_active' => false])->assertStatus(409);
        $this->assertTrue($this->admin->fresh()->is_active);
        $this->assertTrue($this->admin->fresh()->isSuperAdmin());
    }

    public function test_cinema_scoped_staff_can_only_assign_cinemas_they_hold(): void
    {
        $mine = $this->cinema;
        $other = Cinema::factory()->create();
        $lead = $this->withPermissions(['staff.manage', 'tickets.validate', 'tickets.view'], $mine);

        $this->as($lead);
        $this->create(['email' => 'd@example.test', 'cinemas' => [$other->public_id]])->assertStatus(409)->assertJson(['code' => 'privilege_escalation']);
        $this->create(['email' => 'e@example.test', 'cinemas' => [$mine->public_id]])->assertCreated();
    }

    public function test_you_cannot_change_your_own_roles_or_lock_yourself_out(): void
    {
        $second = $this->staff(Role::SuperAdmin);

        $this->as($this->admin);
        $this->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['roles' => ['ticket_checker']])->assertStatus(409)->assertJson(['code' => 'self_modification']);
        $this->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['is_active' => false])->assertStatus(409)->assertJson(['code' => 'self_modification']);
        $this->assertTrue($this->admin->fresh()->isSuperAdmin());
        $this->assertNotNull($second);
    }

    public function test_the_last_active_super_admin_is_protected(): void
    {
        // The fixture creates an extra super admin to publish the showtime; make `admin` the only one.
        DB::table('user_roles')->where('role_id', AccessRole::where('key', 'super_admin')->value('id'))->where('user_id', '!=', $this->admin->id)->delete();
        $this->admin->flushAccessCache();
        $this->assertTrue($this->admin->fresh()->isLastActiveSuperAdmin());

        $helper = $this->withPermissions(['staff.manage', 'roles.manage']);
        $this->as($helper)->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['is_active' => false])->assertStatus(409);
        $this->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['roles' => ['ticket_checker']])->assertStatus(409);

        // With a second super admin, one may demote the other; the survivor is then protected again.
        $second = $this->as($this->admin)->postJson('/api/v1/admin/staff', ['name' => 'Second Admin', 'email' => 'second.admin@example.test', 'roles' => ['super_admin']])->assertCreated()->json('data.id');
        $this->assertFalse($this->admin->fresh()->isLastActiveSuperAdmin());
        $secondUser = User::where('public_id', $second)->first();
        $this->as($secondUser)->patchJson("/api/v1/admin/staff/{$this->admin->public_id}", ['roles' => ['ticket_checker']])->assertOk();

        $this->assertTrue($secondUser->fresh()->isLastActiveSuperAdmin());
        $this->as($helper)->patchJson("/api/v1/admin/staff/{$secondUser->public_id}", ['is_active' => false])->assertStatus(409);
        $this->assertTrue($secondUser->fresh()->is_active);
    }

    public function test_deactivating_staff_ends_their_sessions_and_blocks_login(): void
    {
        $target = $this->staff(Role::TicketChecker, ['email' => 'door@example.test']);
        DB::table('sessions')->insert(['id' => 'sess-door', 'user_id' => $target->id, 'payload' => '', 'last_activity' => time()]);

        $this->as($this->admin)->patchJson("/api/v1/admin/staff/{$target->public_id}", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $target->id)->count());
        $this->assertSame(1, AuditLog::where('action', 'staff.deactivated')->count());

        $this->app['session.store']->flush();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/staff/login', ['email' => 'door@example.test', 'password' => self::PASSWORD])->assertStatus(422);
        $this->as($this->admin)->patchJson("/api/v1/admin/staff/{$target->public_id}", ['is_active' => true])->assertOk();
    }

    public function test_role_changes_are_audited_with_before_and_after(): void
    {
        $target = $this->staff(Role::TicketChecker);
        $this->as($this->admin)->patchJson("/api/v1/admin/staff/{$target->public_id}", ['roles' => ['payment_verifier', 'ticket_checker']])->assertOk();

        $log = AuditLog::where('action', 'staff.roles_changed')->firstOrFail();
        $this->assertSame(['ticket_checker'], $log->metadata['before']);
        $this->assertSame(['payment_verifier', 'ticket_checker'], $log->metadata['after']);
        $this->assertEqualsCanonicalizing(['payment_verifier', 'ticket_checker'], $target->fresh()->roleKeys()->all());
    }

    public function test_plain_customers_cannot_be_edited_through_staff_endpoints(): void
    {
        $this->as($this->admin)->patchJson("/api/v1/admin/staff/{$this->customer->public_id}", ['roles' => ['super_admin']])->assertNotFound();
        $this->assertFalse($this->customer->fresh()->isStaff());
    }

    public function test_only_super_admins_reset_mfa_and_never_their_own(): void
    {
        $target = $this->staff(Role::PaymentVerifier);
        $target->forceFill(['mfa_secret' => 'JBSWY3DPEHPK3PXP', 'mfa_confirmed_at' => now()])->save();
        $lead = $this->withPermissions(['staff.manage']);

        $this->as($lead)->postJson("/api/v1/admin/staff/{$target->public_id}/reset-mfa")->assertForbidden();
        $this->as($this->admin)->postJson("/api/v1/admin/staff/{$this->admin->public_id}/reset-mfa")->assertStatus(422);
        $this->postJson("/api/v1/admin/staff/{$target->public_id}/reset-mfa")->assertOk();
        $this->assertNull($target->fresh()->mfa_confirmed_at);
        $this->assertNull(DB::table('users')->where('id', $target->id)->value('mfa_secret'));
    }

    // --- Roles -------------------------------------------------------------------------------------

    public function test_roles_can_be_listed_created_edited_and_deleted_but_built_ins_are_immutable(): void
    {
        $this->as($this->admin);
        $roles = $this->getJson('/api/v1/admin/roles')->assertOk()->json('data');
        $this->assertContains('payment_verifier', array_column($roles, 'key'));
        $this->assertArrayHasKey('payments', $this->getJson('/api/v1/admin/permissions')->json('data'));

        $made = $this->postJson('/api/v1/admin/roles', ['name' => 'Floor staff', 'permissions' => ['tickets.validate', 'tickets.view']])->assertCreated();
        $key = $made->json('data.key');
        $this->assertSame('custom_floor_staff', $key);
        $this->postJson('/api/v1/admin/roles', ['name' => 'Floor staff', 'permissions' => ['tickets.view']])->assertStatus(422);
        $this->postJson('/api/v1/admin/roles', ['name' => 'Bad', 'permissions' => ['everything.all']])->assertStatus(422);
        $this->postJson('/api/v1/admin/roles', ['name' => '<b>x</b>', 'permissions' => ['tickets.view']])->assertStatus(422);

        $this->patchJson("/api/v1/admin/roles/{$key}", ['name' => 'Floor staff', 'permissions' => ['tickets.view']])->assertOk()->assertJsonPath('data.permissions', ['tickets.view']);
        $this->assertSame(1, AuditLog::where('action', 'role.permissions_changed')->count());

        $this->patchJson('/api/v1/admin/roles/payment_verifier', ['name' => 'Hacked', 'permissions' => ['payments.verify']])->assertStatus(409)->assertJson(['code' => 'system_role']);
        $this->deleteJson('/api/v1/admin/roles/super_admin')->assertStatus(409);

        $member = $this->staff(Role::TicketChecker);
        $member->roles()->attach(AccessRole::where('key', $key)->first());
        $this->deleteJson("/api/v1/admin/roles/{$key}")->assertStatus(409)->assertJson(['code' => 'role_in_use']);
        $member->roles()->detach(AccessRole::where('key', $key)->first());
        $this->deleteJson("/api/v1/admin/roles/{$key}")->assertOk();
    }

    public function test_role_management_cannot_be_used_to_escalate(): void
    {
        $editor = $this->withPermissions(['roles.manage', 'tickets.view']);

        $this->as($editor)->postJson('/api/v1/admin/roles', ['name' => 'Mega', 'permissions' => ['tickets.view', 'payments.verify']])->assertStatus(409)->assertJson(['code' => 'privilege_escalation']);
        $this->postJson('/api/v1/admin/roles', ['name' => 'Viewer', 'permissions' => ['tickets.view']])->assertCreated();
        foreach ([$this->verifier, $this->manager(), $this->checker, $this->customer] as $user) {
            $this->as($user)->postJson('/api/v1/admin/roles', ['name' => 'Anything', 'permissions' => ['tickets.view']])->assertForbidden();
        }
    }

    // --- Promotions ----------------------------------------------------------------------------------

    public function test_promotions_are_managed_validated_and_protected(): void
    {
        $this->as($this->manager())->getJson('/api/v1/admin/promotions')->assertForbidden();
        $this->as($this->verifier)->postJson('/api/v1/admin/promotions', ['code' => 'X1', 'type' => 'fixed', 'value' => 100])->assertForbidden();

        $this->as($this->admin);
        $id = $this->postJson('/api/v1/admin/promotions', [
            'code' => 'summer-10', 'type' => 'percent', 'value' => 10, 'min_amount' => 20000, 'max_discount' => 5000, 'usage_limit' => 100, 'per_user_limit' => 1,
            'movies' => [$this->movie->public_id], 'cinemas' => [$this->cinema->public_id],
        ])->assertCreated()->assertJsonPath('data.code', 'SUMMER-10')->json('data.id');

        $this->postJson('/api/v1/admin/promotions', ['code' => 'Summer-10', 'type' => 'fixed', 'value' => 1000])->assertStatus(422)->assertJsonValidationErrors('code');
        $this->postJson('/api/v1/admin/promotions', ['code' => 'BIG', 'type' => 'percent', 'value' => 150])->assertStatus(422)->assertJsonValidationErrors('value');
        $this->postJson('/api/v1/admin/promotions', ['code' => 'a b', 'type' => 'fixed', 'value' => 100])->assertStatus(422);
        $this->postJson('/api/v1/admin/promotions', ['code' => 'NEG', 'type' => 'fixed', 'value' => -5])->assertStatus(422);
        $this->postJson('/api/v1/admin/promotions', ['code' => 'DATES', 'type' => 'fixed', 'value' => 5, 'starts_at' => '2026-12-01', 'ends_at' => '2026-11-01'])->assertStatus(422);
        $this->postJson('/api/v1/admin/promotions', ['code' => 'USED', 'type' => 'fixed', 'value' => 5, 'used_count' => 99])->assertCreated()->assertJsonPath('data.used_count', 0);

        $this->patchJson("/api/v1/admin/promotions/{$id}", ['is_active' => false, 'used_count' => 0])->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertSame(1, AuditLog::where('action', 'promo.updated')->count());

        // Used codes are kept for the record; unused ones can go.
        $user = User::factory()->create();
        $booking = $this->reserve($user, ['A1']);
        PromoRedemption::create(['promo_code_id' => $id, 'user_id' => $user->id, 'booking_id' => $booking->id, 'amount' => 1000]);
        $this->as($this->admin)->deleteJson("/api/v1/admin/promotions/{$id}")->assertStatus(409)->assertJson(['code' => 'has_redemptions']);
        $unused = PromoCode::where('code', 'USED')->value('id');
        $this->deleteJson("/api/v1/admin/promotions/{$unused}")->assertOk();
    }

    public function test_a_percent_value_over_100_cannot_sneak_in_through_an_update(): void
    {
        $id = $this->as($this->admin)->postJson('/api/v1/admin/promotions', ['code' => 'PCT', 'type' => 'percent', 'value' => 10])->assertCreated()->json('data.id');
        $this->patchJson("/api/v1/admin/promotions/{$id}", ['value' => 250])->assertStatus(422);
        $this->assertSame(10, (int) PromoCode::find($id)->value);
    }
}
