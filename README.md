# xflushx

An independent Chrome extension for cleaning copied X/Twitter links, saving and copying feed photos, and muting accounts using locally defined location rules.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the `extension` directory.
4. Refresh open X tabs.

After updating the files, reload the extension and refresh X tabs. No build or dependencies are required.

## Features

- Remove query strings from copied X/Twitter URLs, with an on/off switch.
- Optional photo menu: Save image, Copy image, Copy image link, and Open image. Falls back to displayed size if original size is unavailable.
- Local country/region mute rules with a complete bundled UN M49 hierarchy, explicit aliases, and custom locations.
- Independent region-label and country controls, plus an Allow/Mute preference for successful lookups without a location.
- One location lookup attempt per permanent numeric account ID, with persistent local results.
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
