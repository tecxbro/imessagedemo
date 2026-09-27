# Frozen interfaces

The build pack's `CONTRACTS.md` was not in the workspace. These notes are the freeze, taken from the pinned registry rather than from the other host.

## What is frozen

- `DemoFlow` message kinds match the pinned `MessageKind` except `typing`, plus the renderer-hosted `app-card` below. Typing stays on `MessageList`'s `typing` prop. The pinned union is `"text" | "link" | "attachment" | "image" | "audio" | "typing"`.
- `system` is not a demo message kind. On this pin, system lines are `SystemMessage`, a standalone component.
- `IosMessagesAppProps.contact` and `MacMessagesAppProps.contact` are required. `messages` is required. `screen` defaults inside the shell; the demo frame still names an `IosScreen`.
- `RendererProps` is `{ compiled, frame }` for both adapters. `RendererHandle` is `{ seek, element }`.
- `IosCatalogueScene` and `MacCatalogueScene` take `CatalogueSceneProps` and are exported from the platform renderer indexes. They throw `NOT_IMPLEMENTED` until a lane replaces them.
- Polls and mini apps are unsupported. They are recorded in `capabilities.json` and are not part of `DemoFlow`. The single exception is `kind: "app-card"` with an `appCard` payload (`url`, `live: true`, `app: "checkout"`, optional `height`): a live Photon checkout, iOS only. It is not a pinned `MessageKind`; the iOS renderer lays it out as a plain row and docks the checkout iframe in it (`src/renderers/ios/app-card/`). See `docs/apple-pay-presentation.md`.
- Motion numbers live in `motion-tokens.json`. They were parsed from the named exports. `iosScreenTransition` is `unverified` because the source comment says so. `screenEffectDuration` is `unverified` because the source says the timings are a well-known look rather than a capture.

## Host divergence, not adopted

`https://imessage.swerdlow.dev/r/registry.json` was fetched and hashed. It is not the installed pin. It has 55 items, seven modules this pin does not, and a `MessageKind` that adds `system`. Those fields are listed under `absentFromPin`. Adopting them would expand the freeze past the single registry response this repository installs.

## Lane stubs

`validateDemo`, `compileDemo`, `stateAt`, `frameAt`, `createPlayer`, `IosDemoRenderer`, `MacDemoRenderer`, `DemoPlayer`, and `src/cli/main.ts` throw `NOT_IMPLEMENTED`. Test doubles live in `tests/contracts/doubles.ts`.
