import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("accepts same-site relative paths", () => {
    expect(safeRedirect("/booking/checkout?x=1")).toBe("/booking/checkout?x=1");
  });
  it.each(["https://evil.test", "//evil.test", "/" + String.fromCharCode(92) + "evil.test", "javascript:alert(1)", "evil", "", null, undefined])(
    "rejects %s",
    (value) => {
      expect(safeRedirect(value as string, "/fallback")).toBe("/fallback");
    },
  );
});
