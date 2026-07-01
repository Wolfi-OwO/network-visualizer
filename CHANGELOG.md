# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to adhere to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Breaking:** authentication endpoints moved from `/api/auth/*` to `/auth/*`.
  Re-register your OAuth redirect URIs with each provider as
  `<public URL>/auth/{google|microsoft}/callback`.
- OAuth redirect URIs and post-login redirects are now derived from the
  incoming request instead of a statically configured base URL.

### Removed

- **Breaking:** the `API_URL` and `APP_URL` environment variables are no longer
  read; they can be deleted from deployment configuration.

### Added

- Production documentation set: security policy, contributing guide, API
  reference, issue/PR templates, and this changelog.
