# Privacy and data handling

## Source distribution

The repository ships executable source, geographic reference data, documentation, and synthetic tests. It does not include any actual user's rules, location cache, muted-account list, account IDs, session credentials, browser data, or screenshots.

The application-level bearer token in `extension/api.js` is shared X web-client configuration. It is not a personal credential. The extension obtains the current user's session information at runtime; no personal session values are embedded in this repository.

## Data stored locally at runtime

Chrome's `storage.local` stores preferences, rules, mappings, numeric account IDs, display handles, reported locations and Connected via labels, lookup outcomes, review entries, mute action records, imported muted-account snapshots, and queue state. These records can identify accounts and should be treated as private if exported or copied. This browser storage is separate from the source directory.

The code explicitly reads the `ct0` session CSRF cookie and `twid` signed-in account ID cookie. Their values are not saved in the extension's local storage. Authenticated requests use the browser's existing cookies. The extension does not explicitly read the `auth_token` cookie.

## Network destinations

- `x.com` and `twitter.com`: authenticated account/location lookups, mute-state checks, mute actions, and muted-list imports.
- `pbs.twimg.com`: image retrieval or saving when a photo action is requested.
- `cdn.syndication.twimg.com`: public metadata for the clicked post, only when needed to resolve a video or animation action; sent without cookies and not saved.
- `video.twimg.com`: video and GIF-video retrieval or saving when a media action is requested. GIF encoding runs locally; converted GIF bytes are sent only through internal extension messaging to Chrome's download API.

There is no project-owned server, analytics endpoint, cloud cache, or telemetry. Links in documentation and the settings source attribution open only when chosen by the user.

## Permissions

| Permission | Purpose |
| --- | --- |
| Storage | Persist local preferences, rules, and account records |
| Cookies | Read session CSRF and signed-in identity on permitted X hosts |
| Downloads | Save an image when requested |
| Clipboard write | Copy images and image links when requested |
| Alarms | Continue queued imported-account location checks |
| X/Twitter host access | Run page features and authenticated requests |
| Image host access | Retrieve requested X media |

## Before sharing files

Share only the repository source. Do not add browser profile directories, local-storage exports, HAR/network captures, cookies, screenshots of private data, or personal test fixtures. A `.gitignore` helps prevent accidental additions, but it does not remove files already committed. Browser runtime storage is not included in the repository.


The identity reader also inspects same-origin GraphQL responses that X already loads. It extracts numeric account IDs and handles in page memory to support detection and profile visits. Full response bodies, post text, messages, and request headers are not forwarded or persisted. This adds no identity-lookup network requests.
