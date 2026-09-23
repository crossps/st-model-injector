# Model Injector — agent notes

- The user runs SillyTavern on **both PC and phone (Android/Termux)**. Every UI change must work on mobile:
  - verify at 1366x768 **and** a phone viewport (390x844, `is_mobile`, touch) before shipping;
  - rows must wrap (flex-wrap) with no horizontal overflow at 360px;
  - keep touch targets ~32px+, use native `<select>`s (mobile pickers), avoid hover-only affordances;
  - keep option labels short: they render in the native mobile picker.
- Settings persist via ST `extensionSettings` (never localStorage).
- Companion server plugin: https://github.com/crossps/st-model-injector-server
- Verification harness used for v1.0.0: sandbox ST with `--configPath`/`--dataRoot`, mock upstream on 127.0.0.1:9814, Playwright (Edge). Accept ST's "Connecting To Proxy" confirm popup in scripts.
