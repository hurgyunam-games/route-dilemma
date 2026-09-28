import { describe, expect, it } from "vitest";
import { DEFAULT_BATTLE_BGM_FILE, WORLD_BGM_FILE, battleBgmFile } from "./bgm-tracks";

describe("battle BGM by map", () => {
  it("assigns a battle loop to each map", () => {
    expect(battleBgmFile(1)).toBe(DEFAULT_BATTLE_BGM_FILE);
    expect(battleBgmFile(2)).toBe("bgm-shop.ogg");
    expect(battleBgmFile(3)).toBe("bgm-mighty-kingdom.ogg");
    expect(battleBgmFile(4)).toBe("bgm-frozen-abyss.ogg");
    expect(battleBgmFile(5)).toBe("bgm-decisive-battle.ogg");
    expect(WORLD_BGM_FILE).not.toBe(battleBgmFile(4));
    expect(WORLD_BGM_FILE).not.toBe(battleBgmFile(5));
  });
});
