# xflushx

An independent Chrome extension for cleaning copied X/Twitter links, saving feed photos, videos and animations, and muting accounts using locally defined location rules.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the `extension` directory.
4. Refresh open X tabs.

After updating the files, reload the extension and refresh X tabs. No build or dependencies are required.

## Features

- Remove query strings from copied X/Twitter URLs, with an on/off switch.
- Optional photo menu: Save image, Copy image, Copy image link, and Open image. Falls back to displayed size if original size is unavailable.
- Local country/region mute rules with a bundled UN-based hierarchy, supplemental entries, custom display labels, explicit aliases, and custom locations.
- Independent region-label and country controls, plus an Allow/Mute preference for successful lookups without a location.
- Cached location lookups by permanent numeric account ID, persistent pending queues, and automatic rate-limit cooldown recovery.
- Video downloads and local animated-GIF conversion through the optional media menu.
- Unmute with permanent local exceptions, grouped mute history, inline country-code badges, and a local KPI dashboard.
- Review unexpected location labels and map them manually. Each distinct unaddressed label contributes one toolbar badge alert.
- Import the signed-in account's muted list and distinguish verified tool actions, legacy/outside-tool mutes, and older records.

Automatic muting and the photo menu default off. Link cleanup defaults on. No rules or account data are bundled.

## Privacy

See [PRIVACY.md](PRIVACY.md) for stored data, permissions, and network requests. This source distribution contains no browser profiles, cookies, personal account data, screenshots, or local rule exports. Tests use synthetic fixtures and do not contact X.

## Development

Requires a current Node.js release supporting Unicode regular expression `v` mode. Run from the repository root:

```sh
node tests/run.cjs
```

The tests cover matching, identity handling, queueing, cache behavior, mappings, provenance, and UI logic using mocks. They do not replace testing against a signed-in Chrome session.

## Limitations

The extension uses undocumented X web endpoints and rendered React user objects. X can change these interfaces. Failed or ambiguous identity lookups never trigger a mute. X's reported location is not proof of nationality, VPN use, or account-creation location.

Location checks run gradually. Failed attempts remain cached until explicitly cleared. Changing rules does not undo existing mutes. Mute provenance is based on local recorded actions; manual changes between list syncs cannot always be reconstructed.

## Data and references

The bundled country/area hierarchy is derived from [UN M49](https://unstats.un.org/unsd/methodology/m49/overview/). North America is an additional composite of Northern America, Central America, and the Caribbean; it is distinct from UN Northern America.

Request-format references:

- [X request examples](https://github.com/fa0311/twitter_api_safe_relay_skills/blob/main/skills/twitter-api-relay/requests.ndjson)
- [Wire protocol documentation](https://github.com/mudrii/gobird/blob/main/docs/wire-protocol.md)
- [Mute endpoint reference implementation](https://github.com/d60/twikit/blob/main/twikit/client/v11.py)

This project is independent of X Corp. The original project code is licensed under GNU GPL version 3 only (`GPL-3.0-only`). See [LICENSE](LICENSE). Distributed modified versions of covered code must meet the GPLv3 source-availability and licensing requirements. Commercial use is permitted.


## License scope

The GPLv3 applies to the original project code. Existing third-party material and geographic reference data retain their applicable terms and attribution. References to X endpoints and shared web-client configuration do not grant rights over X services or trademarks.


## Animation downloads (1.8)

With Photo actions menu enabled, right-click a video-backed GIF and choose **Save as animated GIF**. Conversion happens locally, without a server or additional software. The output is a looping GIF at up to 320 pixels on its longest side and 10 frames per second. Animations longer than 15 seconds are rejected without truncation; **Save original video** preserves the original MP4 instead. Conversion shows progress and may take a little time.

Native GIF, animated PNG, WebP, AVIF, and other images use **Save image (native format)**. Saving preserves the bytes and format returned by the image host; it does not flatten or convert native image animations. Copying an image to the clipboard remains a separate PNG operation.

GIF detection supports X's `video.twimg.com/tweet_video/` MP4 sources and matching GIF poster URLs. Other video players or changed X markup may not be detected. Reload the extension, accept access to `video.twimg.com` if Chrome requests it, and refresh open X tabs after this update.


### GIF overlay detection (1.8.1)

Right-clicking a transparent player overlay is supported by locating the media under the pointer. For blob-backed players without an exposed media URL, the extension can resolve the clicked post's GIF using X's public syndication metadata. This request runs only after choosing an animation action, uses no session cookies, and does not persist the response. Private or unavailable posts may not resolve through this fallback. Refresh X tabs after updating.


## Connected via rules (1.9)

Location rules now match either **Account based in** or the geographic portion of **Connected via**. For example, `Australasia App Store` matches the `Australasia` region label. The settings page has an **Include Connected via in location rules** checkbox (enabled by default); disabling it restores account-based-only matching. The two original values remain separate in the cache and muted-account table. Verified new mute records identify which field and rule matched. Generic client labels such as Web and Android are not treated as geographic locations.

Australasia is an explicit custom group using the UN Australia and New Zealand region for optional country inclusion; X's boundaries may differ. Selecting its region-label checkbox alone does not select its constituent countries. New unrecognized Connected via geographic labels enter the normal mapping/review workflow.

Older cached entries did not store Connected via. Use **Refresh older caches missing Connected via** to explicitly allow a new lookup for old successful/missing results. This does not clear current-format results or failed lookups, and never unmutes accounts. Encountered accounts are queued again; use **Check pending locations** to refill locations for the imported muted list. A fresh lookup stores both fields, then returns to check-once caching. The new behavior has automated fixture coverage; it still requires a live signed-in X check.


## Account detection fix (1.9.1)

An IntersectionObserver race could leave an already visible account unqueued when its numeric ID arrived later. The observer is now explicitly re-armed when the ID binding changes. Profile visits no longer require the profile heading to contain a self-link. The identity reader passively extracts numeric ID / handle pairs from same-origin GraphQL responses already requested by X (fetch and XMLHttpRequest), with rendered-user data retained as a fallback. It does not add identity requests, modify headers, store response bodies, or forward tweet/message content. Only validated numeric ID / handle pairs are forwarded to the isolated queue. Location responses must still match the expected ID before they can trigger muting. Refresh X tabs after loading the update.


## Mute diagnostics and explicit retry (1.9.2)

Lookup status & cache accepts a numeric account ID or @handle. Its detail view shows the cached lookup, whether automatic/Connected via matching is enabled, the current matching rule/field, global pause reason, and recorded mute attempts with their errors. Handles are only a local search aid; lookup/mute identity remains numeric.

Resume queue / retry failed mutes authorizes one new attempt for previously failed or interrupted mute actions encountered again. It reuses cached locations and rechecks existing mute state before any write, so it does not blindly submit an uncertain mute twice. Confirmed successful mutes are not retried. Failed location lookups remain cached until separately cleared. A retry that fails again requires another explicit Resume action. No mute success is inferred from merely detecting or caching an account.


## Mute-state verification (1.9.3)

If an accepted mute response omits the expected account/muting fields, a read-only follow-up checks the requested target's current mute state. Success is recorded only with explicit muting=true. A returned mismatched account ID is rejected. If the follow-up still reports false or no state, the attempt stays failed with a specific diagnostic; Resume queue checks again using cached location data. An account already muted after an older uncertain attempt is shown as muted with uncertain origin, not falsely credited as a verified tool action or classified as definitely legacy. This adds a follow-up request only when the write response is insufficient.


## Video downloads (1.10)

With Photo actions menu enabled, right-click a video to choose **Save video** or **Copy video address**. Direct X MP4 sources are saved as video files without conversion. For blob-backed players, public post metadata resolves an MP4 variant; the highest reported bitrate is selected. When there are multiple videos, the player poster is used to identify the clicked one. GIF and native photo actions remain available. Live/HLS-only, private, unavailable, or ambiguous media may not expose a downloadable MP4 and return a clear error. No additional software is required. No extra host permissions are added by this release.


### Quoted-post video downloads (1.10.1)

Video resolution also examines quoted posts, including nested quotes. Repeated media entries are deduplicated by MP4 sources; unrelated reply-parent media is excluded. If several videos remain, the clicked player's poster selects the matching media; ambiguous results return an error rather than downloading an arbitrary video.


## Compact cache and player targeting (1.11)

Lookup status & cache groups all cached accounts by Account based in. Groups start collapsed and show account/mute counts; expanding them shows Connected via and action state. Click a handle to inspect its existing diagnostic record. Red rows with struck-through handles indicate muted state from the selected account's latest confirmed action or list snapshot; failures, interrupted actions, other-account records, and accounts absent from a newer complete snapshot are not marked muted. Cache maintenance and request settings are collapsed separately.

Video targeting also recognizes lazy player containers, video thumbnail placeholders, and control/letterbox areas outside a video element's bounds. Source resolution still checks quoted-post media and restricts downloads to X MP4 sources. These changes have automated coverage; live player variations may still need browser verification.


## Inline cached country codes (1.12)

Cached accounts display a bold ISO 3166-1 alpha-2 pair after the display name and before verification: **Account based in / Connected via** (for example US/US or JP/JP). Different codes are red. Region labels, unmapped countries, unavailable values, and generic connection clients without a country use XX and make the pair red, including XX/XX. Codes come from the bundled UN country/area ISO fields and explicit aliases; regions are never guessed as countries. The native profile hover card shows both reported values.

This display uses existing numeric-ID-bound local cache records only; it performs no extra account requests or identity lookup. Uncached accounts are not labeled. Earlier cache records missing Connected via will show XX on that side until explicitly refreshed. Names in quoted posts use the same treatment. Placement is tested against a mocked name/verification layout and still needs confirmation against the live X layout.


## Compact quote authors (1.12.1)

Quoted-post cards with plain-text author headers are now observed even without the usual User-Name profile anchor. A dedicated @handle span plus avatar identifies the rendered author header; body mentions within tweetText and cards without avatars are excluded. The handle is bound to a validated numeric identity learned from X's existing response before the card can be queued. Late identity arrival re-arms observation, and the normal shared ID cache prevents duplicate location lookups. Inline country labels also support these quote headers. The extension still does not locally remove already rendered quote cards; inspect cache/mute confirmation to verify action success. Live markup variants still need browser confirmation.


### Profile-heading identity fallback (1.12.3)

When the identity response was already loaded or missed, a plain profile heading is inspected for matching numeric user data, without requiring a profile link. About, replies, media, highlights and articles paths are recognized. Conflicting or differently named user records are rejected. The cache search now supports partial handles; selecting an account for cache maintenance still requires its full handle or numeric ID.


### Consistent cache filtering (1.12.4)

Search cached accounts accepts partial handles with or without @, case-insensitively, as well as exact numeric IDs. The tree is filtered and matching branches open automatically. Full-handle/ID matches open diagnostics; a single partial result can also be inspected, while multiple matches remain listed for selection. Cache clearing requires an exact selected account and is disabled for ambiguous or partial queries. Clearing the search restores the tree. Asynchronous refreshes use a sequence guard so stale reads cannot overwrite newer search results. Search is local and performs no account requests.


## Native profile-hover location details (1.13)

Country-code badges no longer use a browser title tooltip. Cached Account based in, Connected via, the ISO pair, and the XX explanation are appended as a compact location section at the bottom of supported native X profile hover cards. A DOM observer updates newly opened cards promptly; reused cards remove or replace stale subjects. No lookup is initiated when hovering an uncached account. X's hover-card markup can change, so live placement still requires browser verification.


## Automatic rate-limit recovery (1.15)
The extension continues collecting discovered account IDs into a local pending queue during a cooldown. The queue is deduplicated by signed-in account and permanent target ID, persists across background-worker/browser restarts, and resumes with the same X account signed in and Automatic muting enabled. Chrome must be running to process work. No new API lookups run during the cooldown.

HTTP 429 responses use Retry-After and x-rate-limit-reset when available, with a small safety margin. Without server timing, the cooldown starts at 15 minutes and doubles for repeated limits, up to 24 hours; the backoff resets after a day without throttling. Account jobs are spaced at least 30 seconds apart (verification may require multiple requests within a job). Queue status shows the pending count and scheduled resume time. Old indefinite HTTP 429 pauses are upgraded automatically. Successful cached results remain; only explicitly rate-limited lookups retry automatically. Other failed/interrupted lookups and authentication pauses retain their existing manual recovery behavior.


## Local dashboard (1.18)
The Dashboard tab displays recorded mute totals by location and origin, current verified tool mutes by date over the last 14 days, cached lookup outcomes, location coverage, country-code disagreements, local exceptions, and queue/cooldown health. Mute totals and pending work are scoped to the selected X account; cache metrics are shared locally. These are latest-record metrics rather than lifetime analytics. The dashboard reads local storage only and makes no additional X requests.


## Automatic mute reconciliation (1.19)
Unconfirmed or interrupted mute attempts receive read-only state checks, one per eligible minute, sharing the account request interval and rate-limit cooldown. A current confirmed mute after a recorded attempt is credited to the tool, per the configured attribution convention, with inferred-after-attempt metadata retained. The displayed date is the original attempt date without a time. Confirmed unmutes clear active errors and update the local list. Unknown responses preserve uncertainty and retry later rather than asserting success. Complete mute-list syncs can also reconcile these records without extra state requests. Original attempt errors remain available as history.
