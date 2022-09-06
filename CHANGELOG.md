# Changelog
All notable changes to this project will be documented in this file.

## [2.9.1] - 2022-09-06
### Added
- Added support for ESP32 boards

## [2.9.0] - 2022-06-06
### Added
- Added support for "Arduino RP2040 Connect" board
### Changed
- Improved support for Chrome's Web Serial API on ChromeOS. Other operating systems should not be affected.
- Simplified the communication with the Web Serial API via a messaging system which simulates
  the [postMessage](https://developer.chrome.com/docs/extensions/reference/runtime/#method-Port-postMessage) function available in the Chrome App Daemon (see `chrome-app-daemon.js`).

## [2.8.0] - 2022-03-21
### Added
- Added support (still in Beta) for Chrome's Web Serial API on ChromeOS.
  Other operating systems should not be affected.
