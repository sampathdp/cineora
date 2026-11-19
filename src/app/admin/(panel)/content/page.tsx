import type { Metadata } from "next";
import { ContentAdmin } from "@/components/admin/content-admin";

export const metadata: Metadata = { title: "Content" };

export default function Page() {
  return <ContentAdmin />;
}
