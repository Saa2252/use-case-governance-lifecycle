# Media

Images generated from the app itself. Rebuild them all with `../tools/make-assets.sh`.

| File | What it is | Size |
|---|---|---|
| `00-lifecycle-diagram.png` | The six-gate diagram, with the fail loop and the model-change loop | 3200 × 1800 (2× of 1600 × 900) |
| `card-00.png` … `card-08.png` | Nine summary cards: opening question, gates 1–6, the no-go moment, closing | 2160 × 2160 (2× of 1080 × 1080) |
| `walkthrough.gif` | Click-through of the app, gate 1 → gate 6, pausing on the gate 3 failure | 1000 px wide, roughly 1-2 MB depending on encoding |
| `frames/` | Source frames for the GIF, also usable as standalone screenshots | 2800 × 1800 |
| `cards.html` | Source for the summary cards. `#card-N` shows one card, so each is captured on its own. | — |

The diagram is authored by hand at [`../assets/lifecycle-diagram.svg`](../assets/lifecycle-diagram.svg); the PNG here is a 2× render of it.

The app screenshots are captured from the running app rather than mocked up, so they cannot drift from what it actually does. The GIF frames follow the deep links documented in the main [README](../README.md#deep-links).
