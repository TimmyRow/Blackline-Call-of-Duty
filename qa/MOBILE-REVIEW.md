# iPhone and iPad compatibility pass

## Implemented

- Automatic touch detection, including iPad desktop-style identification.
- Multi-touch movement stick, swipe look, held fire with drag-to-aim, aim/run/crouch toggles, held interaction, reload, jump, vehicle boarding/exit and flight ascent/descent. Firing cancels a foot sprint; vehicle changes clear held controls.
- Touch map, journal, pause and a compact More menu for ship tracking, squad orders, ammunition, grenades and audio.
- Pointer capture with release/cancellation handling. Movement and firing reset across pauses, backgrounding and rotation. Pointer lock is optional and never requested in touch mode.
- Portrait and landscape layouts, safe-area spacing, scrollable menus and usable targets down to 320 CSS pixels wide. Compass ship marker stays inside narrow displays.
- Mobile Auto starts with shadows/bloom off, no multisampling, a 1x maximum pixel ratio and a 950,000-pixel tablet budget, plus existing adaptive scaling. This limits GPU load rather than guaranteeing a device-specific frame rate.
- Audio initialization supports the prefixed Web Audio constructor and cannot block deployment when audio is unavailable. The local Windows WebKit build lacks AudioContext; it now starts silently instead of failing.

## Validation

45 unit tests pass. `qa/mobile-test.mjs` passes seven Chromium touch scenarios: opening/skip, simultaneous genuine multi-touch movement/look/fire through CDP, cancelled interactions, recovery/repair/flight, menus, boats, and orientation/layout changes. It also checks run-to-fire cancellation and crouch toggling.

Playwright WebKit successfully initializes WebGL 2, starts the game through a tap, skips the opening and opens/closes the map without page errors. `qa/mobile-layout-test.mjs` checks small iPhone portrait/landscape, simulated notch/home-indicator insets and an iPad viewport in WebKit. Primary targets stay on-screen and do not intersect; journal close remains reachable. Screenshots were visually inspected. The five-scenario desktop Crashfall regression suite also passes, including keyboard movement, ship recovery and save/continue. Production TypeScript/Vite build and diff checks pass.

These are desktop-engine tests with emulated device metrics and touch input. They do **not** certify physical iPhone/iPad GPU speed, thermal behavior, real Safari toolbar/safe-area behavior, or audio output on iOS hardware. Use an up-to-date Safari with hardware-accelerated WebGL 2. Existing browser-local saves remain separate across devices.

## Platform references

WebKit documents [Pointer Events](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/), [viewport-fit and safe-area insets](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), and [WebGL 2 support](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/). The implementation uses those browser capabilities with optional audio/pointer-lock guards.
