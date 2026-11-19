<?php

namespace Tests\Feature\Foundation;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiFoundationTest extends TestCase
{
    public function test_health_endpoint_reports_ok_with_envelope_and_hardening_headers(): void
    {
        $r = $this->getJson('/api/v1/health');

        $r->assertOk()->assertJson(['success' => true, 'data' => ['status' => 'ok']]);
        $r->assertHeader('X-Content-Type-Options', 'nosniff');
        $r->assertHeader('X-Frame-Options', 'DENY');
        $this->assertNotEmpty($r->headers->get('X-Request-Id'));
    }

    public function test_connected_to_mysql_with_utc_and_krw_config(): void
    {
        $this->assertSame('mysql', DB::connection()->getDriverName());
        $this->assertSame('UTC', config('app.timezone'));
        $this->assertSame('KRW', config('cineora.currency'));
    }

    public function test_malformed_client_correlation_id_is_replaced(): void
    {
        $r = $this->getJson('/api/v1/health', ['X-Request-Id' => 'bad id <script>']);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9\-]{8,64}$/', $r->headers->get('X-Request-Id'));
    }

    public function test_unknown_api_route_returns_json_404_envelope(): void
    {
        $this->getJson('/api/v1/nope')->assertNotFound()->assertJson(['success' => false, 'code' => 'not_found']);
    }

    public function test_unauthenticated_request_returns_401_envelope(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized()->assertJson(['success' => false, 'code' => 'unauthenticated']);
    }

    public function test_validation_error_envelope(): void
    {
        Route::post('/api/v1/_test_validate', fn () => request()->validate(['a' => 'required']))->middleware('api');
        $this->postJson('/api/v1/_test_validate', [])
            ->assertStatus(422)
            ->assertJson(['success' => false, 'message' => 'The submitted information is invalid.'])
            ->assertJsonStructure(['errors' => ['a']]);
    }

    public function test_unhandled_exception_does_not_leak_details_when_not_debug(): void
    {
        config(['app.debug' => false]);
        Route::get('/api/v1/_test_boom', fn () => throw new \RuntimeException('SQLSTATE secret detail'))->middleware('api');
        $r = $this->getJson('/api/v1/_test_boom');
        $r->assertStatus(500)->assertJson(['success' => false, 'code' => 'server_error']);
        $this->assertStringNotContainsString('SQLSTATE', $r->getContent());
    }
}
