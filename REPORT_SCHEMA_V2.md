# TCGate Report Schema V2

`reportSchemaVersion: 2` is an additive extension of `tcgate-alpha-complete-report`. Legacy fields remain present so existing consumers continue to work.

## Envelope

`envelope` contains the TCGate version, deployed build SHA when exposed by the runtime, environment, pseudonymous session identifier, Host/Guest role, parsed browser and OS, capture timestamp, timezone, selected game, and `tcg`/`no-game` mode. Missing facts are `null`; they are never inferred as zero.

## Diagnostics

- `diagnostics.network`: current WebRTC/ICE/signaling state, sanitized selected-route categories, aggregate RTP counters, bounded track summaries, ICE restart/reconnection counters, disconnected duration, and a network-state-only timeline.
- `diagnostics.vision`: availability, versions when exposed, bounded performance and outcome aggregates, rejection counters, worker/fallback state, and the last sanitized errors.
- `diagnostics.database`: active game/version/SHA/source, load/cache/fallback/validation facts, aggregate content counts, and bounded problematic identifiers.

Collectors are independent and fault-isolated. A missing subsystem is `unavailable`; a failed collector is `error`; neither prevents the remaining report or gameplay.

## Limits and privacy

Network events: 64; Vision errors: 24; database problems: 32; error strings: 240 characters; section target: 96 KiB; V2 extension: 384 KiB; complete report target: 768 KiB. If the complete report crosses that target, the compatible Legacy event list is reduced to its last 256 entries and gets explicit truncation metadata. Bounded lists include `totalItems`, `retainedItems`, and `truncated`.

The V2 collectors never intentionally include SDP, raw candidates, full IP addresses, TURN credentials, authorization data, cookies, tokens, audiovisual content, image descriptors, or user-journey events. Keys matching sensitive categories are removed and error strings are redacted. The legacy event stream is retained only for backward compatibility and is not copied into V2.

The Cyberpunk database diagnostic reports the immutable source actually configured and loaded by the Alpha; it never selects, upgrades, activates, or rolls back a database. On the Candidate 13 baseline, the observed technical source is database `1.1.0` at SHA `56402636a77af9c8b5dc4e3b61c509a185f3c834`. That observation is not, by itself, a product-promotion decision. Manifest, checksum, worker/model, and cache-age fields remain `null` when the active runtime does not expose them.
