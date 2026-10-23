# Company demo authoring review

## Audit and scope

The October 2026 audit found existing instructions for official logo preparation/wiring, visual approval, purposeful media selection, and read-only diagnosis. Those policies were retained. Asset preflight already validated a supplied contact photo's path and raster dimensions. Generic validation did not require a company avatar or outgoing receipt transitions. The additions are a company authoring preflight and an explicit newly authored receipt default, plus the corresponding avatar/receipt evidence in the existing visual review.

The [renderer skill](../.agents/skills/make-imessage-demo/SKILL.md) owns commands. Supply `--company-review <file>` on validate, compile, preview, and capture for newly authored company flows, including requests that prescribe a storyline. Assemble an authorized sheet first, then review the final flow ID. Existing fixtures and generic/exact flow rendering remain compatible without this flag. The CLI cannot infer that an arbitrary flow represents a company; following the skill's required flag remains part of the authoring workflow.

## Separate review file

The review is local authoring context, not a field in a flow or a new renderer capability. Example:

```json
{
  "flowId": "company-use-case",
  "avatar": { "source": "https://company.example/brand/logo.svg" },
  "receiptExceptions": []
}
```

Record the actual official HTTP(S) logo source. The main flow contact must wire a real square PNG/JPEG/GIF/WebP through `contact.photo`; existing asset preflight verifies the file. Square geometry does not prove correct logo padding or authenticity. Inspect the header and record source provenance in the existing research notes.

An avatar fallback is permitted only for an explicit user request or a documented unavailable asset. Replace `avatar` with an exception, for example:

```json
{
  "exception": "user-request",
  "reason": "The user explicitly requested initials.",
  "evidence": "Verbatim user instruction and its conversation reference."
}
```

`exception` can also be `unavailable`; record attempted official sources and the actual access/asset failure in `evidence` and report the limitation. An unavailable logo remains a presentation limitation. Never claim it was applied. The checker validates this record's structure, not the identity of its author or the truth of its evidence.

Each visible outgoing iMessage text needs Delivered then a later Read status event before the next text in that conversation. An initially Read message, incoming Read status, or a read event at the same timestamp as delivery cannot prove the visible transition. A later regression from Read before the next text also fails. SMS text and non-text messages are outside this default. A terminal outgoing text still needs its transition in the authored timeline.

For an explicit override or preserved transcript, add a per-message item to `receiptExceptions`:

```json
{
  "messageId": "outgoing-id",
  "basis": "preserve-transcript",
  "reason": "The supplied transcript ends at Delivered.",
  "evidence": "Actual supplied transcript and its source reference."
}
```

`basis` is `preserve-transcript` or `user-request`. Blank, duplicate, unknown, or incoming-message exceptions fail. A generic reason is not authorization to invent an exception. No network calls or flow rewrites occur during review. Polls and chat images remain story-dependent and are never required by this check.

## Completion evidence

Use the existing visual review to inspect the official avatar and both receipt states in real playback. Keep actual capture paths, message IDs, playback times, and accepted exceptions in the working notes. Review a sheet's normal-play opening under its existing skill when one is present. Source validation, recorded provenance, captured pixels, and observed playback are separate evidence; a passed preflight is not visual approval. Review claims must describe only what was observed.
