import { describe, expect, it } from "vitest";
import {
  ALLY_GOLD,
  ALLY_GOLD_REWARD,
  ALLY_TYPE_IDS,
  allyGoldReward,
  allyTypeAt,
} from "./allies";

describe("ally types", () => {
  it("gives each type a different gold reward", () => {
    expect(ALLY_GOLD.porter).toBe(ALLY_GOLD_REWARD);
    expect(ALLY_GOLD.courier).toBeGreaterThan(ALLY_GOLD.porter);
    expect(ALLY_GOLD.runner).toBeGreaterThan(ALLY_GOLD.courier);
    expect(ALLY_GOLD.merchant).toBeGreaterThan(ALLY_GOLD.runner);
    expect(allyGoldReward(null)).toBe(ALLY_GOLD_REWARD);
  });

  it("cycles types in spawn order", () => {
    expect(allyTypeAt(0)).toBe("porter");
    expect(allyTypeAt(1)).toBe("courier");
    expect(allyTypeAt(2)).toBe("runner");
    expect(allyTypeAt(3)).toBe("merchant");
    expect(allyTypeAt(ALLY_TYPE_IDS.length)).toBe("porter");
  });
});
