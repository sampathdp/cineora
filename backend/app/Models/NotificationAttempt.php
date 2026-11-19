<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationAttempt extends Model
{
    public $timestamps = false;

    protected $fillable = ['notification_ref', 'channel', 'status', 'error_summary'];
}
