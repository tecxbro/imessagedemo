# Company analysis for a Photon demo

Read this reference when the user supplies a company name, product URL, or asks for a company-specific demo without already prescribing the complete transcript.

## Research the product, not just the brand

Start with the user-supplied URL and current first-party sources. Inspect the official homepage, product pages, documentation, pricing or plan pages, product demos/screenshots, customer/use-case pages, and official media or brand kit when available. Reuse current repository research packs when their provenance is clear, but verify drift-prone product facts before relying on them.

Do not create an account, accept terms, grant OAuth access, submit sales forms, book, buy, upgrade, or cross another gated boundary unless the user separately authorizes it. A blocked or untested feature is an unknown, not evidence that the product lacks it.

Collect only what changes the demo:

- product one-liner and target user;
- primary job-to-be-done and current workflow;
- natural inputs, outputs, core object, and decisive action;
- the smallest moment when the product proves value;
- the most credible place where iMessage improves speed, participation, capture, approval, or follow-through;
- public CTA, pricing, or upgrade model if it determines the mini-app action;
- product voice, official logo/mark, brand palette evidence, and useful product imagery.

Prefer evidence in this order for branding: published brand guidelines or media kit, official SVG/CSS/logo assets, then current first-party product or marketing screenshots. Keep downloaded assets and representative screenshots directly accessible in the worktree when the repository already has a research convention.

## Separate evidence from the PM decision

Maintain four labels while reasoning:

- **Observed:** visible in the current product or official page.
- **First-party claim:** stated by the company but not independently exercised.
- **Inferred:** the PM decision for this demo.
- **Unknown:** not verified or blocked.

Do not present an inferred Photon workflow as an existing company feature. Do not invent live integrations, data access, generation, diagnoses, bookings, approvals, or payments. Static demo data may model the workflow when it is clearly scripted.

## Select one demo thesis

Choose one narrow story instead of recreating the entire product. A good thesis is recognizable to the company, makes iMessage necessary rather than decorative, reaches a useful proof moment in a short rehearsal, and ends in one sensible mini-app action.

Write the internal thesis in this form:

> In iMessage, **[user]** sends or asks **[natural input]**. The agent returns **[recognizable product value]**. After **[decision or proof gate]**, the mini-app lets them **[single next action]**.

In `photon-travel-demo`, that next action is the canonical Apple Pay checkout. Identify the evidence-backed item, amount, and billing unit, but treat them as a proposal until the user answers the required preflight in [Canonical Sites and Apple Pay](sites-apple-pay.md).

Prefer roughly four to eight meaningful turns. Fewer is fine when the product is naturally simple. Avoid a long onboarding sequence when an asset-first, alert-first, or request-first opening better matches the product.

Reject a concept when it is only a generic chatbot with the company name, requires fabricating a core capability, has no reason to live in a messaging thread, or sends a mini-app before the conversation demonstrates value.

## Produce the demo brief

Before implementation, record these decisions in working notes or the handoff:

| Field | Decision |
| --- | --- |
| Product truth | What the company demonstrably does |
| Target user and job | Who is acting and what they need |
| iMessage wedge | Why this belongs in a conversation |
| Scripted proof | The deterministic result or artifact |
| Input and media | Text, photos, files, participants, or reaction needed |
| Conversation gates | Exact state transitions and recovery behavior |
| Mini-app moment | Trigger, action, displayed data, and destination route |
| Brand evidence | First-party asset and palette provenance |
| Scope boundaries | Mocked, unknown, local-only, hosted, and device-run limits |

Continue to [Conversation design](conversation-design.md) and turn this brief into the exact executable transcript. For the canonical Sites and Apple Pay workflow, always present the proposed route, checkout item/amount, and transcript in the required short preflight before implementation. In other frameworks, ask only if no defensible thesis can be selected from the prompt, product evidence, and existing demo framework.
