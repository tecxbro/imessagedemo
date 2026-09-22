# iMessage demo maker

Local studio for authoring a visual Messages demo and previewing it from the pinned iMessage UI components.

## 1. Author and validate a flow

Write a `DemoFlow` that matches `src/contracts/index.ts`, then validate and compile it.

```sh
npm run demo
```

`npm run demo` is **NOT_IMPLEMENTED** until the compiler and CLI lanes are integrated. It exits with `NOT_IMPLEMENTED: demo`.

## 2. Preview and capture

Foundation shells mount the stock iOS and macOS apps with a fixed fixture. They do not call the unfinished lanes.

```sh
npm run dev -- --host 127.0.0.1 --port 4173
```

Open `/?foundation=ios` or `/?foundation=macos`. Add `&theme=dark` for the dark ancestor.

```sh
npm run test:e2e
```

That command is the foundation shell capture. A demo-timeline capture command is **NOT_IMPLEMENTED** until the player lane is integrated.

## Checks

```sh
npm run typecheck
npm run build
npm run test:unit
npm run verify:upstream
```
