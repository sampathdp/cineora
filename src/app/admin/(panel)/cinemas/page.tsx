import type { Metadata } from "next";
import { CinemasAdmin } from "@/components/admin/cinemas-admin";

export const metadata: Metadata = { title: "Cinemas" };

export default function Page() {
  return <CinemasAdmin />;
}
