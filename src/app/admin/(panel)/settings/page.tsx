import type { Metadata } from "next";
import { SettingsAdmin } from "@/components/admin/settings-admin";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsAdmin />;
}
