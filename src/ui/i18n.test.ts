import { describe, expect, it } from "vitest";
import { en } from "@/ui/locales/en";
import { ko } from "@/ui/locales/ko";
import {
  content,
  pickLocale,
  saveSlotTitle,
  setLocale,
  t,
  translateCommandReason,
} from "@/ui/i18n";

describe("locale", () => {
  it("uses a saved choice, otherwise Korean only for Korean browsers", () => {
    expect(pickLocale("en", "ko-KR")).toBe("en");
    expect(pickLocale("ko", "en-US")).toBe("ko");
    expect(pickLocale(null, "ko-KR")).toBe("ko");
    expect(pickLocale(null, "en-GB")).toBe("en");
    expect(pickLocale(null, "ja")).toBe("en");
  });

  it("keeps the same keys in English and Korean", () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });

  it("fills the active language and leaves custom save names alone", () => {
    setLocale("en");
    expect(t("world.title")).toBe("World map");
    expect(t("world.stageNow", { stage: 6 })).toBe("Current stage 6");
    expect(saveSlotTitle("세이브 2")).toBe("Save 2");
    expect(saveSlotTitle("My run")).toBe("My run");
    expect(content("enemy.slime.name", "슬라임")).toBe("Slime");
    expect(content("enemy.custom.name", "실험체")).toBe("실험체");
    expect(translateCommandReason("골드가 부족합니다 (필요 10, 보유 3)")).toBe(
      "Not enough gold (need 10, have 3)",
    );

    setLocale("ko");
    expect(t("world.title")).toBe("월드맵");
    expect(saveSlotTitle("세이브 2")).toBe("세이브 2");
    expect(translateCommandReason("타워가 없습니다")).toBe("타워가 없습니다");
  });
});
