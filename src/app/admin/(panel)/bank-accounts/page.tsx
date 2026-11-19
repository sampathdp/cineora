import type { Metadata } from "next";
import { BankAccounts } from "@/components/admin/misc-admin";

export const metadata: Metadata = { title: "Bank accounts" };

export default function Page() {
  return <BankAccounts />;
}
