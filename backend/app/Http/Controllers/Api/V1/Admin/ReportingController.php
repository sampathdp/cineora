<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Cinema;
use App\Services\Audit\AuditLogger;
use App\Services\Reporting\ReportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Dashboard numbers and reports. Everything is calculated by the backend and narrowed to the viewer's cinemas. */
class ReportingController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::DashboardView), 403);
        $days = (int) ($request->validate(['days' => ['sometimes', 'integer', 'between:7,90']])['days'] ?? 30);

        return ApiResponse::success((new ReportService($request->user()))->dashboard($days));
    }

    public function types(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(Permission::ReportsView), 403);

        return ApiResponse::success(collect(ReportService::TYPES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values());
    }

    /** @return JsonResponse|StreamedResponse JSON by default; `format=csv` needs reports.export */
    public function show(Request $request, string $type, AuditLogger $audit): JsonResponse|StreamedResponse
    {
        $user = $request->user();
        abort_unless($user->hasPermission(Permission::ReportsView), 403);
        abort_unless(isset(ReportService::TYPES[$type]), 404);

        $v = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'cinema' => ['sometimes', 'nullable', 'string', 'size:26'],
            'group' => ['sometimes', 'in:day,month'],
            'format' => ['sometimes', 'in:json,csv'],
        ]);
        $tz = config('cineora.timezone');
        $from = Carbon::createFromFormat('Y-m-d', $v['from'], $tz)->startOfDay()->utc();
        $to = Carbon::createFromFormat('Y-m-d', $v['to'], $tz)->endOfDay()->utc();
        abort_if($from->diffInDays($to) > 366, 422, 'Choose a range of at most one year.');

        $cinemaId = null;
        if (! empty($v['cinema'])) {
            $cinema = Cinema::where('public_id', $v['cinema'])->firstOrFail();
            abort_unless($user->isSuperAdmin() || $user->assignedCinemaIds()->contains($cinema->id), 403);
            $cinemaId = $cinema->id;
        }

        $report = (new ReportService($user))->run($type, $from, $to, $cinemaId, $v['group'] ?? 'day');

        if (($v['format'] ?? 'json') === 'csv') {
            abort_unless($user->hasPermission(Permission::ReportsExport), 403);
            $audit->log('report.exported', $user, 'report', $type, ['from' => $v['from'], 'to' => $v['to'], 'rows' => count($report['rows'])]);
            $name = "cineora-{$type}-{$v['from']}-{$v['to']}.csv";

            return response()->streamDownload(function () use ($report) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel reads Korean text correctly
                fputcsv($out, array_column($report['columns'], 'label'));
                foreach ($report['rows'] as $row) {
                    fputcsv($out, array_map(fn ($c) => ReportService::csvCell($row[$c['key']] ?? null), $report['columns']));
                }
                fclose($out);
            }, $name, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
        }

        return ApiResponse::success($report, meta: ['type' => $type, 'from' => $v['from'], 'to' => $v['to'], 'can_export' => $user->hasPermission(Permission::ReportsExport)]);
    }
}
