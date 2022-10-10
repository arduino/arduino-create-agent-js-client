# Changelog
All notable changes to this project will be documented in this file.

## [2.11.0] - 2022-09-27

### Changed
- When using Web Serial API, the interactions between the client library
  (as an example, the Arduino `arduino-chromeos-uploader` libray) has been simplified.
- A new parameter `dialogCustomizations` has been added to the upload functionality. It's used
  to provide custom confirmation dialogs when using the Web Serial API.
  It has no effect with other daemons.

### Removed
- `cdcReset` functionality, now it's embedded in the `upload` functionality
  in the Web Serial daemon.
### Changed

## [2.10.1] - 2022-09-08

### Changed
- Fixed a bug released in 2.9.1 caused by the wrong assumption that the build filename is always at the end of the command line. This fix makes the library backward compatible with older ESP boards.

## *DEPRECATED* [2.9.1] - 2022-09-06
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
