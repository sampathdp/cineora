import type { Metadata } from "next";
import { SeatLayoutPage } from "@/components/admin/seat-layout-editor";

export const metadata: Metadata = { title: "Seat layout" };

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <SeatLayoutPage roomId={roomId} />;
}
