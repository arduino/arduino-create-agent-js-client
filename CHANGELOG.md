# Changelog
[2.9.1-alpha.2] - 2022-08-17

### Changed
- The error `No device found` coming from the `arduino-create-agent` is now treated as an error.

[2.9.1-alpha.1] - 2022-07-28

### Added
- Added support for ESP boards (experimental)

[2.9.0] - 2022-06-06
### Added
- Added support for "Arduino RP2040 Connect" board
### Changed
- Improved support for Chrome's Web Serial API on ChromeOS. Other operating systems should not be affected.
- Simplified the communication with the Web Serial API via a messaging system which simulates
  the [postMessage](https://developer.chrome.com/docs/extensions/reference/runtime/#method-Port-postMessage) function available in the Chrome App Daemon (see `chrome-app-daemon.js`).


[2.8.0] - 2022-03-21
### Added
- Added support (still in Beta) for Chrome's Web Serial API on ChromeOS.
  Other operating systems should not be affected.
