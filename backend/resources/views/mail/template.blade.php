<x-mail::message>
@foreach ($lines as $line)
{{ $line }}

@endforeach

@if ($actionUrl)
<x-mail::button :url="$actionUrl">
{{ $actionLabel }}
</x-mail::button>
@endif

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
