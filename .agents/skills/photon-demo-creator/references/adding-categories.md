# Adding a new category

Use this protocol when company analysis produces an interaction pattern that is not adequately covered by travel, health, or video, or when the user explicitly names a new category. Do not ask the user to choose one of the existing categories when the product evidence supports a better new pattern.

## Build before canonizing

1. Inspect the current conversation, target workspace instructions, source, assets, process, and relevant prior demo artifacts.
2. Use the company brief and conversation-design reference to derive the exact scripted transcript, content types, asset gates, reactions, mini-app moment, and code/cloud/Site boundaries. Treat a user-supplied transcript as authoritative.
3. Implement and verify the current demo within the user's authorized scope.
4. Record only behavior that was requested and observed. Mark historical, local-only, provider-accepted, hosted, and physical-device facts separately.

Do not invent a category playbook from its industry label. Select the demo from the product's observed workflow, iMessage wedge, and proof moment. Ask for the minimum missing concept only when no defensible interaction can be inferred from the company/product evidence and current framework.

## Update this skill

After reusable behavior exists, use the `skill-creator` skill to update `/Users/darshan/.codex/skills/photon-demo-creator`:

- Add `references/<category-slug>.md` with the category's intent, proven flow, asset contract, mini-app boundary, known source baselines, verification, and failures to avoid.
- Add a route link under “Route the work” in `SKILL.md` only when the new interaction topology is reusable enough to deserve a permanent first-class reference. A company-specific variant alone does not require a new category.
- Preserve the complete travel, health, and video references. Do not rewrite another category to make room for the new one.
- Keep brand names, prices, URLs, project IDs, phone numbers, and filenames labeled as historical examples unless they are true invariants.
- Do not include secrets, tokens, private CLI JSON, personal phone numbers, or transient process IDs.
- If implementation is incomplete, document only stable requirements and label the entry incomplete rather than claiming a proven template.
- Run `quick_validate.py` and inspect every link from `SKILL.md` before reporting the library updated.

The user's instruction to add a new category authorizes this narrow skill-library update. It does not authorize unrelated publication, cloud deletion, paid upgrades, live messages, or modification of older categories.
