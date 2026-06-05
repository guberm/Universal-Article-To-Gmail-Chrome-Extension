# Changelog

## [1.6.3] - 2026-06-05

### Added
- Added a dynamic `Pick Content` action in the popup and side panel. Users can start a picker on the active tab, hover any page element, and click it to copy that element's content to the clipboard without creating or saving a site configuration.
- Added dynamic picker support for both rich HTML clipboard payloads and plain text mode, using the existing clipboard settings and toast feedback.

### Changed
- The existing XPath selector picker and the new dynamic content picker now share the same hover highlight interaction while keeping their results separate.

## [1.6.2] - 2026-06-04

### Changed
- Site config editing now suppresses self-triggered storage refreshes while typing, reducing flicker and keeping the caret stable.
- Adding a new site now moves focus directly to the new rule's Name field.
- Site card titles update live while editing the Name field without requiring a full card re-render.

## [1.6.1] - 2026-06-04

### Added
- Added an interactive XPath picker for site selectors. Users can click `Pick`, hover elements on the active page, and click an element to save a unique indexed XPath.
- Added XPath selector support in article extraction while preserving existing CSS selector behavior.

### Changed
- Selector rows now include a dedicated picker action without changing the stored site configuration format.

### Fixed
- Selector and field focus now stays on the edited rule after re-rendering, even when another rule has the same value.

## [1.6.0] - 2026-05-29

### Added
- Refreshed the side panel and popup UI with a sticky header, search clear action, site count, cleaner config cards, duplicate site action, empty states, and improved settings layout.
- Added more resilient Gmail compose body detection for the `?fs=1&tf=cm` compose popup.

### Changed
- Gmail body lookup now uses a shared selector helper across initial wait, mutation observer, periodic checks, and insertion.
- Gmail compose insertion now retries while the message body is still rendering instead of treating the first missed lookup as a final failure.
- Site config structural actions now save immediately before re-rendering.

### Fixed
- Site config edits while search is active now save the full configuration list instead of replacing storage with only filtered results.
- Gmail pending article data is now cleared only after body insertion succeeds, preventing lost articles when compose detection fails or retries.
- Duplicate Gmail insertion attempts are ignored while an insertion is already in progress.

## [1.5.2] - 2025-07-27

### Fixed
- Converted relative image URLs to absolute URLs before inserting copied article content into Gmail.

## [1.5.1] - 2025-07-27

### Added
- Added search support for site configurations in the side panel.

## [1.5.0] - 2025-07-27

### Added
- Added Clipboard API integration as a transfer path between article pages and Gmail.
- Added structured clipboard payloads with timestamps.
- Added fallback handling through clipboard, storage, and error recovery paths.
- Added visual feedback for processing and data source status.

### Changed
- Switched the primary article transfer path from direct storage-only flow to a clipboard-backed flow.
- Improved synchronization between article and Gmail content scripts.
- Added timeout and validation handling for clipboard operations.

### Fixed
- Fixed synchronization problems between article extraction and Gmail insertion.
- Reduced data loss when moving between tabs.
- Improved reliability for large HTML payload transfers.

## [1.4.1] - 2025-07-27

### Added
- Added Chrome side panel support.

### Changed
- Moved configuration management toward the side panel while preserving existing settings and behavior.

## [1.4.0] - 2025-07-27

### Added
- Added JSON import and export for site configurations.
- Added tracing support through `tracing.js`.
- Added automatic clipboard copy with HTML and plain text modes.
- Added toast notifications for clipboard success and failure.
- Added responsive best-fit image sizing in the Gmail compose body.
- Added persisted user settings under `userSettings`.

## [1.3.1] - 2025-07-27

### Added
- Added clipboard permission groundwork and tracing preparation.

## [1.2.0] - 2025-07-27

### Changed
- Extended Gmail field selectors for To, Subject, and Body fields.
- Improved field population with focus and event dispatching.
- Improved Gmail loading wait mechanisms.

## [1.1.0] - 2025-07-27

### Changed
- Added multiple selector fallbacks.
- Added MutationObserver handling for Gmail DOM changes.
- Improved logging, debugging, timing, and retry behavior.

## [1.0.0] - 2025-07-27

### Added
- Added basic article extraction.
- Added Gmail compose integration.
- Added configurable site selectors.
- Added automatic To, Subject, and Body population.
