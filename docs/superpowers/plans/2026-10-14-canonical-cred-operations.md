# Canonical CRED Operations Plan

**Date:** 2026-10-14
**Status:** Approved in conversation

## Goal

Keep current production CRED scores synchronized to the canonical public scorer without changing the vNext shadow-only boundary. Add bounded scheduled execution, durable per-run evidence, and machine-readable failure state.

## Safety boundary

- Preserve the reviewed fail-closed requirement of exactly 5,003 Helixa rows. A roster-size change fails and alerts; it never silently widens scope.
- Update only persisted Helixa rows selected by the hardened synchronization tool. Generic agents remain untouched.
- Require a unique compact rollback database and immutable report for every apply.
- Refuse overlap through systemd and a filesystem lock.
- Run at low CPU/I/O priority, verify the compact backup and every applied Helixa row, then publish status atomically.
- CRED vNext remains offline and cannot affect production scores, tiers, privileges, rewards, APIs, oracle state, or contracts.

## Tasks

1. Add an operational runner around the reviewed canonical sync tool.
2. Test success, failure redaction, row verification, backup verification, and non-overwrite behavior.
3. Install a locked systemd oneshot and daily timer after inspecting existing schedulers.
4. Run one production invocation and verify service health, status, backup, report, and public score consistency.
5. Keep the 688-subject verified corpus in shadow mode and publish a deterministic full replay artifact.
