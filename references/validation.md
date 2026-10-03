# Validation and platform coverage

Initial private review performed on Windows on 2026-10-02–03, using Node.js 24.15.0,
Git 2.54.0.windows.1, PowerShell 7.6.5 and Windows PowerShell 5.1.26100.9444.
No dependencies were installed. Fixtures invoked no real agent sessions, game
server, GPU workload or daemon.

## Runnable checks

```sh
npm test
node scripts/demo.mjs
node scripts/validate-skill.mjs
node scripts/scan-release.mjs .
```

For the retained trial on Windows:

```powershell
powershell.exe -NoProfile -NonInteractive -File scripts/legacy-tests.ps1
```

The legacy smoke passed 11 checks: initialization, pinned ref read/claim,
unanswered/ACK-only completion refusal, result completion, no terminal reply,
traversal refusal, four competing processes with exactly one claim winner,
STOP refusal and status during STOP. The preserved script hash matches the
inspected source exactly.

The generalized suite passed 30 checks covering lifecycle/receipts,
retry across reopen, per-session fencing, two-step transfer, stale lease recovery,
expiry, STOP, overlapping reservations and independent CPU scopes, critic read
scope, full reference hashes, protected paths/links, hop bounds, leftover locks,
actual competing processes, complete concurrent snapshots, unsupported session
control, config-relative paths and Codex/Claude/mixed synthetic passes. Inspection
added regression cases for TTL-dead custody retained until operator recovery
and refusal to accept a transfer after its source task was answered. Invalid
claim/accept lease inputs now leave ownership and offers intact, and transfer
acceptance refuses unavailable refs while returning changed-ref diagnostics.

An independent forward pass used the shipped skill and CLI in a fresh synthetic
source-processing project, dispatched pinned input to an executor, recorded its
ACK/result and prepared a receipt for the existing integrator. It independently
found the missing reference diagnostics on transfer acceptance. After repair,
changed refs returned diagnostics, deleted refs refused while preserving the old
claim/offer, and restored originals were accepted with a new action key. The
reviewer independently reran all 30 tests and found no remaining functional
blocker for private inspection. Raw synthetic traces stay outside this package;
only this sanitized account is included.

The installed skill-creator's `quick_validate.py` was attempted. Its installed
Python lacks PyYAML (`ModuleNotFoundError: yaml`); no dependency was installed.
The package's dependency-free fallback validates its authored simple frontmatter,
skill name, UI invocation, local reference links and scaffolding. It is not a
general YAML parser. Behavioral proof comes from executable mailbox tests and
an independent forward pass, not that structural fallback.

## Limits and release review

Only this Windows local-filesystem environment was exercised. Node 22+ is the
declared minimum, not a tested matrix. Linux, macOS, network filesystems, power
failure, large-scale throughput and malicious same-user editing are untested.
The complete snapshot retains messages, audit events and idempotency records;
no automatic compaction/retention policy is implemented. Use it for bounded
local projects, not an indefinitely growing distributed service.
Engine fixtures prove distinct Codex-only, Claude-only and mixed labels can use
the transport; they do not prove live host session activation, discovery or ACK.
The optional PR workflow has no automated posting adapter and was not exercised
against a third-party PR. The private repository creation is package delivery,
not a test of PR messaging.

The release scanner inspects staged blobs and all reachable Git commit trees
for credential signatures, personal absolute paths, caller-supplied private
terms, oversized files and unexpected generated artifacts. It is heuristic:
human source/provenance review remains necessary. No private mailbox states,
tokens, logs, local configuration or session evidence belongs in this tree.

Before public release: resolve source rights and license choice, repeat privacy
and history scans, test any newly claimed platform/host adapters, and decide
whether the retained legacy compatibility script remains useful. Session wake
and stop must remain unsupported until a tested adapter is added.
