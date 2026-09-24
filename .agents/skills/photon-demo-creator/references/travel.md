# Travel demos

Use this reference for flight, hotel, villa, itinerary, or travel-checkout demos. These are deterministic sales demos, not live booking agents, unless the user explicitly requests and authorizes real integrations.

## Proven patterns

### Flight flow

The prior travel demo used per-space state and this shape:

1. Ask whether the user wants a flight or hotel.
2. For flights, collect route/dates and timezone.
3. Return a fixed, preclassified option list.
4. A positive selection sends a booking preview or live app card. A negative phrase sends a native poll such as cheaper, earlier arrival, or different airline.
5. A poll vote returns the corresponding fixed refinement and returns to the decision step.
6. `reset` restarts the demo. A deliberate shortcut may send the payment card without changing the current step.

Do not imply that static options came from live search. A mock confirmation must not claim a reservation or charge.

The prior flight demo moved through Axel/Navan-style source, then Wanderlog and GuideGeek cloud/branding changes. Those names are history, not a default. When switching brands, verify the local config, active cloud project, running process, published mini-app, logo/metadata, and old-brand absence independently; updating only colors or only the Photon project is not a completed switch.

### Hotel flow

The proven hotel branch routes `hotel|villa|retreat` immediately, then:

1. Ask budget.
2. Ask location.
3. Send the supplied property images together as one ordered `group(...)`, without “option 1” labels.
4. Track the album children so a heart reaction on a photo selects the fixed property.
5. Send the deterministic name/location/total and the hotel mini-app card, then reset.

The historical example selected Villa Amara in Ubud at `$2,040`. Treat those values as example data, not a default for another brand. If display copy omits decimals but checkout data requires them, keep display `$2,040` separate from payment amount `2040.00`.

### Visa-application flow

A deterministic visa intake can use this shape when it matches the requested transcript:

1. The traveler names the destination and asks to apply.
2. Collect current location and citizenship.
3. Request the required profile photo or document.
4. Accept a single image or an image child from a Spectrum group. If the product-led conversation contract includes a Love tapback, start `message.react("❤️")` on the actual photo immediately and start the read receipt concurrently; neither acknowledgement should delay the next response.
5. Send the fixed eligibility/profile-created copy, then the live mini-app card for the next action.
6. Reset to the opening phase only after the scripted response and card send complete.

Do not make a heart the default for every upload; include it only when the user requests it or the company analysis shows it is a tone-appropriate acknowledgement. For sensitive identity or health material, prefer a read receipt or immediate text confirmation unless the exact flow says otherwise. Keep unsupported attachments at the photo/document gate, and do not claim that a mock profile or payment card created a real visa application.

## Implementation notes

- Keep flight and hotel paths in one explicit transition model when they share a conversation; use distinct steps so a generic “send the link” request can route by current context.
- Native Spectrum polls accept the application title/options. Do not claim control over Apple Messages' visible poll tint without direct evidence.
- For an album, build one supported group and retain individually addressable child messages for reaction matching.
- Handle ambiguous send confirmation per inbound turn so one provider error does not terminate the entire consumer.
- A hosted checkout route is separate from the Spectrum server. In `photon-travel-demo`, use the current typed checkout spec and shared renderer; treat `pho-cx` as a separate legacy surface unless the request explicitly includes it.
- The known Airial/Wanderlog/GuideGeek changes reused card structures and, when requested, existing hosted URLs. Preserve route and deployment identity only when the current user asks for in-place reuse.

## Known source baselines

The current modular implementation in `/Users/darshan/Documents/ChatGPT/photon-travel-demo` uses:

- `src/bootstrap.ts` and `src/demos/registry.ts` for the shared Spectrum loop and demo selection;
- `src/demos/travel/index.ts` for the selectable travel adapter and per-space flow;
- `src/checkout-link-request.ts` for explicit and context-sensitive card requests;
- `src/hotel-flow.ts` for the hotel transition helpers;
- `assets/villas/` for the ordered property album;
- `airial-pay-site/demos/*.ts` and `lib/checkout/` for typed checkout specs and the shared renderer;
- `pho-cx/` for a separate legacy preview/Worker surface.

The active server still depends on `demo.config.json`; source presence does not mean the travel module is selected.

## Verification

Test the applicable happy path, negative/poll path, typed poll fallback, link requests, reaction targeting, reset, missing assets, and per-space isolation. For a visa photo-heart step, delay the mocked read receipt and prove the native heart starts without waiting. Give the user the exact messages to send. Label static data, mock checkout, provider startup, and physical-device rendering separately.
