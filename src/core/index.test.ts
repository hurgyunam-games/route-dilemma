import { describe, expect, it } from "vitest";

describe("core layer", () => {
  it("loads without Vue or Pixi", async () => {
    const core = await import("./index");
    expect(core).toBeTypeOf("object");
  });
});
