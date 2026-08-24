# TCGate C9 — UI 1.0.1 corrective

Corrective pass after real two-device validation.

- Restores the validated prototype proportions: opponent feed is again the dominant surface.
- Narrows the detected-card rail to 214 px and makes its panel compact rather than full-height.
- Uses real colored SVG dice assets directly as `<img>` elements; removes the unreliable CSS-mask rendering.
- Keeps the validated dynamic ownership-box sizing, drag/steal, +/− values, Street Cred and `gig-state` synchronization.
- Keeps Gig Dice strictly Cyberpunk-only.
- Cleans local PiP sizing so only one local video block is visible.
- Fullscreen controls are grouped horizontally in the upper-right chrome and kept clear of the dice bar.
- Fullscreen Gig Dice bar is centered at the bottom by default and remains draggable.
- Card zoom is image-only, uses `object-fit: contain`, hides the squeezed card-name caption and keeps the entire card visible.
- Vision/WebRTC core files are untouched.
