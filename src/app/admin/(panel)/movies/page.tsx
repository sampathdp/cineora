import type { Metadata } from "next";
import { MoviesAdmin } from "@/components/admin/movies-admin";

export const metadata: Metadata = { title: "Movies" };

export default function Page() {
  return <MoviesAdmin />;
}
