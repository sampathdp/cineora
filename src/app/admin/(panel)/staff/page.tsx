import type { Metadata } from "next";
import { StaffAdmin } from "@/components/admin/staff-admin";

export const metadata: Metadata = { title: "Staff and access" };

export default function Page() {
  return <StaffAdmin />;
}
