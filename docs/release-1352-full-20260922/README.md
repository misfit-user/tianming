# 1.3.5.2 full installer candidate

Source integration starts at origin/main 4dedff63 and incorporates the latest local recovery, nonblocking completion, storage and mobile-loading changes. Accepted map: B5/R2 Clarity C1. The previous ship-1.3.5.2 web/source tag is immutable. Full installers use the same prepare/publish command with --full-installers and a separate full-1.3.5.2 tag; no OTA pointers are moved.

## Narrative transport
A real saved turn contained 327 characters of generated annals, a 17-character title and 46-character summary in SC1/SC1d, but the saved history fields were empty. The partial-writeback continuation copied only the main narrative. Recovery now carries all generated record fields; the outer inference exception path also preserves titles, summaries, personnel and prose. SC2 publishes its result before later optional work. Finalization preserves basis_refs and history preserves personnel/suggestions. A read-only replay restored exact existing text; the original player save was not changed.

## Console and Agent world editing
The underlying named-array writer could report a successful Tianyi creation while placing a property on an array; JSON serialization then omitted it. The shared world editor now resolves real array elements by ID/name and uses canonical ingress for characters, parties, classes and armies, including required IDs and links. The tool also supports factions, scalar/object/array edits, deletion, custom world fields and scenario business settings.

Wentian receives real tool schemas and paginated state reads, can preview dependent creations in an isolated world, and gets failed preflight results back for correction. Confirmed operations use an atomic transaction and actual write receipts. Manual Tianyi classification is preserved through both Agent and fallback parsing. Late results cannot target a different save or turn. The same editor is registered for main-turn and recovery/review Agents; recovery can add prerequisites alongside retry_main. Runtime locks, API credentials and JavaScript prototypes are outside game-state editing.

Edits retain current-state references in the saved world and feed both LLM and Agent turn prompts. Tests cover parties, classes, characters, factions and armies, read-back, IDs/mirrors, save/reload, next-turn visibility, isolated preview, correction of missing dependencies, stale-world rejection and atomic rollback.

## Verification status
Targeted narrative test: 63 assertions. World editor integration: 49 assertions. Existing Wentian integration: 37/37. Recovery review: 34/34. Full release gates and archive comparisons are required separately before distribution.
