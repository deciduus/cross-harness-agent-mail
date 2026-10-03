# Validation and platform coverage

Initial private review performed on Windows on 2026-10-02–03, using Node.js 24.15.0,
Git 2.54.0.windows.1, PowerShell 7.6.5 and Windows PowerShell 5.1.26100.9444.
No dependencies were installed. Fixtures invoked no real agent sessions, game
server, GPU workload or daemon.

## Runnable checks

```sh
npm test
node scripts/demo.mjs
node scripts/topology-demo.mjs mixed
node scripts/topology-demo.mjs mixed --outside-direction
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

## Current topology and release review

Version 0.2.0 was reviewed on 2026-10-03. Development, runtime fixtures and the
original archive remained separate; tests ran from a fresh temporary snapshot.
The suite now has 40 checks: the original 30 core checks, five topology checks
and five release-scanner checks. The retained Windows legacy smoke still passes
all 11 checks. No installed execution policy was changed.

The new topology checks exercise Codex-only, Claude-only and mixed synthetic
labels, separate leader/executor/coordinator assignments, named worker custody,
direct user refinement, and explicit upward reconciliation. They compare actual
source/output bytes, keep the first RED candidate, route its receipt to the
coordinator, name the current worker as forward fixer and recheck with the same
reviewer. The current output custodian persists failed evidence after the
read-only reviewer reports it. Final integration happens only after worker
custody is released. The combined artifact hash is
`862a7fc3f978fb1f4775a85c78ac9bcc97d72bb27f0aeaef58aa96f2da5c5711`.
An additional out-of-scope user direction remains held and reported while the
safe original slice completes; no source file is changed. This is explicit
fixture policy, not an implemented natural-language user-message parser.

The independent current-version review ran the complete 40-check suite and
structural validator from another fresh snapshot. It retained and inspected
actual mailbox envelopes and artifact bytes, independently verified the final
content/hash, and found that the outside-scope variant originally reported
`ok` to the user despite held work. After the bounded fix, both user-facing
results report `partial`, naming the leader and a new reconciled input-ownership
packet as the next action. It also rechecked current-custodian evidence
persistence, the explicit leader-to-coordinator RED route and retained source,
scope and token. Raw retained fixtures/reports remain outside this package.

Scanner regression checks cover POSIX and escaped Windows personal paths,
commit-message credentials/private terms, runtime mailbox artifacts and a
clean staged/history tree. The scanner now includes commit subjects/bodies;
author/committer identities need separate human review. Structural validation
still checks links, simple skill/UI frontmatter and the unchanged legacy hash.

See [private review findings](public-review.md) for the source refresh,
installation review and remaining public-release decisions.

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

The release scanner inspects staged blobs, all reachable Git commit trees and
commit subjects/bodies
for credential signatures, personal absolute paths, caller-supplied private
terms, oversized files and unexpected generated artifacts. It is heuristic:
human source/provenance review remains necessary. No private mailbox states,
tokens, logs, local configuration or session evidence belongs in this tree.

Before public release: resolve source rights and license choice, repeat privacy
and history scans, test any newly claimed platform/host adapters, and decide
whether the retained legacy compatibility script remains useful. Session wake
and stop must remain unsupported until a tested adapter is added.
