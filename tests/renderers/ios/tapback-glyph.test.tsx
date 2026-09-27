import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageActions } from "@/components/imessage/message-actions";
import { TapbackGlyph } from "@/components/imessage/tapback";
import { tapbackVisualAt } from "@/contracts/tapback-motion";

describe("tapback glyph parts", () => {
  it("poses HA, the second exclamation, and the question independently of a click", () => {
    const tracks = tapbackVisualAt({ phase: "enter", elapsedMs: 267, entranceElapsedMs: 267 });
    const html = renderToStaticMarkup(
      <MessageActions
        rect={{ x: 24, y: 280, width: 180, height: 36 }}
        frame={{ width: 402, height: 874 }}
        direction="incoming"
        scripted={{ phase: "enter", elapsedMs: 267, entranceElapsedMs: 267 }}
      >
        <span>Where’d u go?</span>
      </MessageActions>,
    );
    expect(html).toContain('data-phase="enter"');
    expect(html).toContain(`data-scale-y="${tracks.glyphs.laughBottom.scaleY}"`);
    expect(html).toContain(`data-scale-y="${tracks.glyphs.emphasizeSecond.scaleY}"`);
    expect(html).toContain(`data-scale-x="${tracks.glyphs.question.scaleX}"`);
    expect(html).not.toContain('data-slot="tapback"');
  });

  it("leaves a settled glyph unmarked by an entrance pose", () => {
    const html = renderToStaticMarkup(<TapbackGlyph type="question" size={25.33} />);
    expect(html).toContain('data-glyph="question"');
    expect(html).not.toContain('data-scale-x="0.12"');
  });
});
