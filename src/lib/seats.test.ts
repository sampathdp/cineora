import { describe, expect, it } from "vitest";
import type { ApiSeat } from "@/lib/api/catalog";
import { zonedParts } from "@/lib/formatters";
import { groupSeats } from "./seats";

const seat = (key: string, status: ApiSeat["status"] = "available", category = "standard"): ApiSeat => ({
  key,
  row_label: key[0],
  number: Number(key.slice(1)),
  category_key: category,
  category_name: category,
  price: 12000,
  status,
  x: null,
  y: null,
});

describe("groupSeats", () => {
  it("groups by row, sorts numerically and marks every non-available state unavailable", () => {
    const rows = groupSeats([seat("B1"), seat("A10"), seat("A2", "sold"), seat("A1", "held"), seat("B2", "unavailable")]);
    expect(rows.map((r) => r.map((s) => s.id))).toEqual([["A1", "A2", "A10"], ["B1", "B2"]]);
    expect(rows[0].map((s) => s.unavailable)).toEqual([true, true, false]);
    expect(rows[1].map((s) => s.unavailable)).toEqual([false, true]);
  });
});

describe("zonedParts", () => {
  it("uses the cinema's calendar day and clock, not the viewer's", () => {
    // 2026-12-01 15:30 UTC is 2026-12-02 00:30 in Seoul (UTC+9)
    expect(zonedParts("2026-12-01T15:30:00Z", "Asia/Seoul")).toEqual({ date: "2026-12-02", time: "00:30" });
    expect(zonedParts("2026-12-01T15:30:00Z", "UTC")).toEqual({ date: "2026-12-01", time: "15:30" });
  });
});
