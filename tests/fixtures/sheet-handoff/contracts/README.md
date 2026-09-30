# Executable contract examples

Run `node contracts/test-sheet-app.mjs` from the handoff root. There are no external JavaScript dependencies.

`sheet-app.schema.json` describes the optional app data. `validate-sheet-app.mjs` demonstrates a separate host-owned human-request gate, pre-generation skip/clarification, required preview/content fields, real resolver requirements, and optional app actions. A model-generated authorization field cannot override the separate receipt.

The example companies/requests are fictional test inputs. Referenced generated hero files and content modules are **not shipped implementations**. Tests use explicit mock resolvers; a production adapter must check actual assets and actual content. The schema, mock resolver tests, and strings alone do not prove semantic brief fidelity, actual human provenance, working actions, or visual quality.

Apply the full JSON Schema as well as the trusted gate in production; the lightweight JavaScript validator is an integration example, not a full JSON Schema engine. Validate generator output after gating, and prove the builder/asset generator is never invoked for unauthorized custom-sheet requests. Existing Lightning and Apple Pay paths are outside this gate.
