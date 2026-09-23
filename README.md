# Model Injector for SillyTavern

Add new model IDs to SillyTavern's Chat Completion model dropdowns yourself, instead of waiting for an ST update.

Supported dropdowns: **Claude, Vertex AI, Google AI Studio, OpenAI, DeepSeek, xAI**.
(OpenRouter and Custom already fetch or accept any model, so they don't need this.)

## Install (PC and phone/Termux)

In SillyTavern: **Extensions → Install extension**, paste:

```
https://github.com/crossps/st-model-injector
```

Then open **Extensions → Model Injector** and click **Add model**. Pick a source, type the model ID (e.g. `claude-opus-5-1`), and it appears at the top of that source's model dropdown under **Custom (Model Injector)**. It also works with connection profiles and survives reloads.

## "Treat as" (optional, needs the server plugin)

SillyTavern decides whether to send thinking, prompt caching, verbosity, and sampling parameters by matching the model name against a hardcoded list. A brand-new name won't match, so those features are silently off.

"Treat as" fixes that: ST builds the request exactly as it would for the model you pick (e.g. `claude-opus-5`), and the real model ID is swapped back in just before the request leaves your ST server. The upstream API or reverse proxy only ever sees the real ID.

This needs the companion server plugin, because the swap has to happen server-side:
**https://github.com/crossps/st-model-injector-server**

Without the plugin, adding models still works; "treat as" is just skipped, and a warning is shown once.

### Picking a "treat as" model

- Pick the closest previous model from the **same family** (e.g. new Opus → latest Opus in the list).
- If the API rejects a parameter (e.g. a renamed thinking option), switch to a different "treat as" model, or set it to `(none)`.
- "Treat as" can only reuse behaviour ST already has; it can't add support for brand-new API features.

## Notes

- Settings are stored in ST's own `settings.json` (per ST install), so add your models once on each device, unless your phone connects to your PC's ST.
- "Treat as" depends on ST internals. If a future ST update breaks it, set the entry to `(none)` until this extension is updated.
