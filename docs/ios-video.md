# Local iOS video messages

A `video` message plays a local MP4 or WebM inside the conversation. This is a repository-owned row rendered through the installed UI's `renderContent` extension; no registry or vendor files are modified.

```json
{
  "id": "memo-video",
  "kind": "video",
  "direction": "incoming",
  "text": "Memo loading the dishwasher",
  "atMs": 1790452827000,
  "video": {
    "src": "/demo-assets/sunday/memo-dishes.mp4",
    "poster": "/demo-assets/sunday/avatar.png",
    "width": 1280,
    "height": 720
  }
}
```

`src` is required. `poster` is an optional local PNG/JPEG/GIF/WebP. Positive `width` and `height` set the aspect ratio; when either is omitted the row defaults to 16:9. `text` labels the video accessibly and supplies the conversation preview. Keep files under `public/demo-assets/`; remote URLs, traversal, unsupported extensions and unknown payload fields are rejected. CLI preflight verifies file containment and the MP4/WebM container signature, plus the poster image. Browser verification remains necessary to prove that the encoded media actually decodes.

The video starts automatically when its message arrives during conversation Play. It is muted and inline to support browser autoplay. Conversation Pause pauses it; Resume continues at the corresponding media time. Seeking sets the video to the elapsed time since its message arrived, clamped at the video's duration. Replay starts the media again on its next arrival. The media clock runs naturally between drift corrections, avoiding a seek on every animation frame.

The message displays only the moving video: no Play video footer, elapsed-time label, scrubber, mute button, fullscreen button, or browser-native media controls. Conversation Play/Pause provides playback control; picture-in-picture and remote playback are disabled. A paused capture seeks to its corresponding decoded video frame; the readiness receipt waits for decoding and seeking and reports failures instead of claiming a ready capture. The optional poster is a loading fallback, not a substitute for playable media. No separate video-control event is required.

This authoring kind is iOS-only. Images, audio, polls and checkout cards retain their own render paths. Video rows can retain quoted replies and show the existing Tapback artwork. The feature does not publish media or place calls.

Checks: `tests/compiler/video.test.ts` covers schema, normalization, deterministic copies and local-file safeguards. `tests/e2e/video.spec.ts` exercises autoplay on arrival, real decoded frames, conversation Play/Pause, backward seek and Replay. The browser test uses the local Sunday asset prepared for this demo.
