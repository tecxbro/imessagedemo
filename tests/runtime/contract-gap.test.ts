import { describe, expect, it } from "vitest";
import motionTokens from "@/contracts/motion-tokens.json";

describe("frozen contract gaps", () => {
  it("does not yet name the overlay timings the runtime still has to cite from source", () => {
    const symbols = motionTokens.tokens.map((token) => token.symbol);
    expect(symbols).not.toContain("replyThreadMotion");
    expect(symbols).not.toContain("messageActionsTiming");
    expect(symbols).not.toContain("contextMenuDismiss");
    expect(symbols).not.toContain("effectsPickerTiming");
  });
});
