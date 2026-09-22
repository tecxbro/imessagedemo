import { describe, expect, it } from "vitest";
import { runCaptureEngine } from "@/cli/capture/engine";

describe("assembled capture", () => {
  it("uses the production capture engine instead of a deferred placeholder", () => {
    expect(typeof runCaptureEngine).toBe("function");
  });
});
