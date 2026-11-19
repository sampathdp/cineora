import type { Metadata } from "next";
import { ShowtimesAdmin } from "@/components/admin/showtimes-admin";

export const metadata: Metadata = { title: "Showtimes" };

export default function Page() {
  return <ShowtimesAdmin />;
}
