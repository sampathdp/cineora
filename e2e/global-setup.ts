import { execFileSync } from "node:child_process";

const env = { ...process.env, APP_ENV: "local", DB_DATABASE: "cineora_e2e", MAIL_MAILER: "log" };
const artisan = (...args: string[]) => execFileSync("php", ["artisan", ...args], { cwd: "backend", env, stdio: "pipe" }).toString();

/**
 * The API server command already rebuilt the schema and demo catalogue. Add the people and money the journeys need:
 * customers, a payment verifier and a ticket checker (both assigned to the cinema), a bank account, and one showtime
 * that is about to start (so the door check-in window is open).
 */
export default async function globalSetup() {
  const php = `
    $cinema = App\\Models\\Cinema::where('slug', 'cineora')->firstOrFail();
    $make = function (string $name, string $email, string $role) use ($cinema) {
      $u = new App\\Models\\User(['name' => $name, 'email' => $email, 'password' => 'E2e-Passw0rd!']);
      $u->is_active = true; $u->email_verified_at = now(); $u->save();
      $u->roles()->attach(App\\Models\\AccessRole::where('key', $role)->value('id'));
      if ($role !== 'customer') { $u->cinemas()->attach($cinema); }
    };
    $make('E2E One', 'e2e.one@example.test', 'customer');
    $make('E2E Two', 'e2e.two@example.test', 'customer');
    $make('E2E Three', 'e2e.three@example.test', 'customer');
    $make('E2E Verifier', 'e2e.verifier@example.test', 'payment_verifier');
    $make('E2E Checker', 'e2e.checker@example.test', 'ticket_checker');
    $make('E2E Admin', 'e2e.admin@example.test', 'super_admin');
    $make('E2E Editor', 'e2e.editor@example.test', 'content_manager');
    App\\Models\\BankAccount::create(['bank_name' => 'E2E Test Bank', 'account_name' => 'Cineora E2E', 'account_number' => '123-456-789012', 'is_active' => true]);

    $movie = App\\Models\\Movie::where('slug', 'ashes-of-the-lantern')->firstOrFail();
    $keep = App\\Models\\Showtime::where('movie_id', $movie->id)->orderBy('starts_at')->firstOrFail();
    App\\Models\\Showtime::where('movie_id', $movie->id)->whereKeyNot($keep->id)->delete();
    $keep->forceFill(['starts_at' => now()->addMinutes(60), 'ends_at' => now()->addMinutes(180)])->save();
  `.replace(/\s+/g, " ");
  artisan("tinker", "--execute", php);
}
