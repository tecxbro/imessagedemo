// Test fixture: the reusable overlay alone in a 512 × 1112 frame, the recording's own coordinate space,
// so captures compare pixel for pixel with the supplied keyframes. `?bg=` points at a calibration
// backdrop the test serves from outside the repository; nothing here ships with the app.
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ApplePayOverlay, type ApplePayOverlayHandle } from "@/renderers/ios/apple-pay/ApplePayOverlay";
// The app's own stylesheet (Tailwind preflight included), so the overlay renders as it does in the phone.
import "@/styles.css";

declare global {
  interface Window {
    capture?: { ready: true; setTime(seconds: number): Promise<void>; setRequest(request: unknown): void; element(): HTMLElement | null };
  }
}

const params = new URLSearchParams(location.search);
const frame = document.getElementById("frame")!;
const background = params.get("bg");
if (background) frame.style.backgroundImage = `url(${JSON.stringify(background)})`;

const twoFrames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function Capture() {
  const overlay = useRef<ApplePayOverlayHandle>(null);
  useEffect(() => {
    window.capture = {
      ready: true,
      async setTime(seconds) {
        overlay.current!.setTime(seconds);
        await twoFrames();
      },
      setRequest: (request) => overlay.current!.setRequest(request),
      element: () => overlay.current?.element ?? null,
    };
    return () => {
      delete window.capture;
    };
  }, []);
  return <ApplePayOverlay ref={overlay} reducedMotion={false} />;
}

createRoot(frame).render(<Capture />);
