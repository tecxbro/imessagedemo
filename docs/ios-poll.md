# iOS poll

Polls are repository-owned. The pinned Messages registry has no poll row. `src/renderers/ios/poll/` docks a host into the real message row. Upstream files stay unchanged.

## Authoring

```json
{
  "id": "dinner-poll",
  "kind": "poll",
  "direction": "incoming",
  "atMs": 0,
  "text": "",
  "poll": {
    "question": "",
    "selectionMode": "single",
    "options": [
      { "id": "heidis", "text": "Heidi’s" },
      { "id": "sushis", "text": "Sushi’s" }
    ],
    "voters": [
      { "id": "me", "avatar": "/demo-assets/ios-poll-reference-voter.png" }
    ]
  }
}
```

```json
{ "type": "poll-vote", "atMs": 1567, "messageId": "dinner-poll", "participantId": "me", "optionId": "heidis", "voted": true }
```

- `question` is a string. `""` shows no heading. The recorded poll has no heading.
- `options` need a stable `id` and `text`. `label` is accepted and stored as `text`. One to twelve options. Ids are unique per poll.
- `selectionMode` `single` replaces that person's previous option. Omitted or `multiple` keeps each selection. The reference fixture is `single` because that is the policy for this comparison, not a claim about every poll.
- `voters` is optional. When present, each `avatar` is a local `/demo-assets/` image, and a vote must name one of those ids. When absent, the face falls back to the participant photo or initials. Do not reuse the reference avatar for another conversation.
- `voterId` is an alias of `participantId`. Omitting `voted` casts the vote (`true`).
- `poll-option` adds a choice. Overlay `poll-details` lists who selected each option. Those paths already existed. The recording does not show a creation sheet, an add button, counts, percentages, or several faces on one row.
- A vote does not scroll the thread. `scroll` is a separate event. The reference fixture includes the recorded downward track after the vote settles. A short transcript has no scroll range, so the leftover distance moves the whole message list down together. It is not part of the poll transition.

Opening votes on the message, with no `atMs`, are already settled. A `poll-vote` event stores its time. The picture at any playback time samples the recorded label, fill, ring, and avatar timing. On the phone, every option is 44px tall. An unselected option is at most 2/5 of the screen width; a longer label uses a smaller size and wraps to two lines. The chosen option expands to 70% of the screen width, overshoots slightly, then settles there. The ring and face are smaller than the recording crop. Pause holds the pose. Seek, Replay, and capture use the same samples. A click in the preview calls the same vote function and does not append another vote for the option that is already selected.

`examples/would-you-rather.flow.json` opens at `/?flow=would-you-rather`. Its question is the text “would you rather,” and the vote selects “mason young sales class.”

## Reference

`examples/ios-poll-vote.flow.json`

- Route: `/?flow=ios-poll-vote`
- Preview: `npm run demo -- preview examples/ios-poll-vote.flow.json --platform ios`
- Label response, original width: `--at-ms 1567`
- Width overshoot: `--at-ms 1900`
- Settled selection: `--at-ms 2434`

`examples/ios-poll.flow.json` is the group poll with more than one selection. Play is the playback button. Replay returns to the authored opening.

## Not measured

Creation, add-option UI, vote counts, percentages, change-vote animation, multi-select layout, dismissal, touch coordinates, and haptics are not in the recording. Light appearance is not in the recording; the capsules use the sampled dark colors in both themes. The later downward movement in the clip is transcript scroll, not a poll close animation.
