<?php

namespace App\Enums;

enum Permission: string
{
    case MoviesView = 'movies.view';
    case MoviesManage = 'movies.manage';
    case MoviesPublish = 'movies.publish';
    case CinemasView = 'cinemas.view';
    case CinemasManage = 'cinemas.manage';
    case RoomsManage = 'rooms.manage';
    case ShowtimesManage = 'showtimes.manage';
    case PricesManage = 'prices.manage';
    case BookingsView = 'bookings.view';
    case BookingsViewCustomer = 'bookings.view_customer';
    case BookingsCancel = 'bookings.cancel';
    case BookingsResolveExceptions = 'bookings.resolve_exceptions';
    case PaymentsView = 'payments.view';
    case PaymentsVerify = 'payments.verify';
    case PaymentsManageBankAccounts = 'payments.manage_bank_accounts';
    case RefundsDecide = 'refunds.decide';
    case TicketsValidate = 'tickets.validate';
    case TicketsView = 'tickets.view';
    case ContentManage = 'content.manage';
    case PromotionsManage = 'promotions.manage';
    case ReportsView = 'reports.view';
    case ReportsExport = 'reports.export';
    case CustomersView = 'customers.view';
    case StaffManage = 'staff.manage';
    case RolesManage = 'roles.manage';
    case SettingsManage = 'settings.manage';
    case AuditView = 'audit.view';
    case DashboardView = 'dashboard.view';

    public function group(): string
    {
        return explode('.', $this->value)[0];
    }

    /** Permissions that apply only within assigned cinemas for non-super-admins. */
    public function isCinemaScoped(): bool
    {
        return in_array($this->group(), ['rooms', 'showtimes', 'prices', 'bookings', 'payments', 'refunds', 'tickets', 'reports', 'dashboard'], true)
            || in_array($this, [self::CinemasManage, self::CinemasView], true);
    }
}
