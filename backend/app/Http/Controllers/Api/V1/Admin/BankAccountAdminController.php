<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Cinema;
use App\Services\Audit\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Where customers send their transfers. Only holders of payments.manage_bank_accounts (super admins by default). */
class BankAccountAdminController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(): JsonResponse
    {
        Gate::authorize('manage', BankAccount::class);

        return ApiResponse::success(BankAccount::with('cinema')->orderBy('id')->get()->map(fn ($a) => $this->present($a))->values());
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage', BankAccount::class);
        $account = new BankAccount($this->rules($request));
        $account->cinema_id = $this->cinemaId($request);
        $account->save();
        $this->audit->log('bank_account.created', $request->user(), 'bank_account', $account->public_id, ['bank' => $account->bank_name]);

        return ApiResponse::success($this->present($account), 'Bank account added.', status: 201);
    }

    public function update(Request $request, BankAccount $bankAccount): JsonResponse
    {
        Gate::authorize('manage', BankAccount::class);
        $bankAccount->fill($this->rules($request, partial: true));
        if ($request->has('cinema')) {
            $bankAccount->cinema_id = $this->cinemaId($request);
        }
        $changed = array_keys($bankAccount->getDirty());
        $bankAccount->save();
        // Which fields changed is recorded; the account number itself never goes into the audit log.
        $this->audit->log('bank_account.updated', $request->user(), 'bank_account', $bankAccount->public_id, ['fields' => $changed]);

        return ApiResponse::success($this->present($bankAccount), 'Bank account updated.');
    }

    private function rules(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'bank_name' => [$req, 'string', 'max:120'],
            'account_name' => [$req, 'string', 'max:120'],
            'account_number' => [$req, 'string', 'max:64', 'regex:/^[0-9A-Za-z\- ]{4,64}$/'],
            'branch' => ['sometimes', 'nullable', 'string', 'max:120'],
            'swift' => ['sometimes', 'nullable', 'string', 'max:16', 'regex:/^[A-Za-z0-9]{8,11}$/'],
            'instructions' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'cinema' => ['sometimes', 'nullable', 'string', 'size:26', 'exists:cinemas,public_id'],
        ]);
    }

    private function cinemaId(Request $request): ?int
    {
        $public = $request->input('cinema');

        return $public ? Cinema::where('public_id', $public)->value('id') : null;
    }

    private function present(BankAccount $a): array
    {
        return [
            'id' => $a->public_id, 'bank_name' => $a->bank_name, 'account_name' => $a->account_name, 'account_number' => $a->account_number,
            'branch' => $a->branch, 'swift' => $a->swift, 'instructions' => $a->instructions, 'is_active' => $a->is_active,
            'cinema' => $a->cinema_id ? ['id' => $a->cinema?->public_id, 'name' => $a->cinema?->name] : null,
        ];
    }
}
