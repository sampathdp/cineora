<?php

namespace App\Enums;

enum Role: string
{
    case SuperAdmin = 'super_admin';
    case CinemaManager = 'cinema_manager';
    case PaymentVerifier = 'payment_verifier';
    case TicketChecker = 'ticket_checker';
    case ContentManager = 'content_manager';
    case Customer = 'customer';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::CinemaManager => 'Cinema Manager',
            self::PaymentVerifier => 'Payment Verifier',
            self::TicketChecker => 'Ticket Checker',
            self::ContentManager => 'Content Manager',
            self::Customer => 'Customer',
        };
    }

    public function isStaff(): bool
    {
        return $this !== self::Customer;
    }

    /** @return list<Permission> */
    public function permissions(): array
    {
        return match ($this) {
            self::SuperAdmin => Permission::cases(),
            self::CinemaManager => [
                Permission::MoviesView, Permission::CinemasView, Permission::CinemasManage, Permission::RoomsManage,
                Permission::ShowtimesManage, Permission::PricesManage, Permission::BookingsView, Permission::BookingsCancel,
                Permission::ReportsView, Permission::DashboardView,
            ],
            self::PaymentVerifier => [
                Permission::PaymentsView, Permission::PaymentsVerify, Permission::BookingsView, Permission::DashboardView,
            ],
            self::TicketChecker => [Permission::TicketsValidate, Permission::TicketsView],
            self::ContentManager => [
                Permission::MoviesView, Permission::MoviesManage, Permission::MoviesPublish, Permission::ContentManage,
                Permission::DashboardView,
            ],
            self::Customer => [],
        };
    }
}
