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

The subsequent documentation checkpoint clarifies dot / the interchangeable
lead chat, PR-first shared coordination, sensitive local handoffs and
host-owned interval receiving. Links/structure/source-hash validation, two
focused capability/configuration checks and the mixed topology demo passed
from a fresh temporary snapshot. Runtime code remains unchanged; these checks
do not validate live timers or a GitHub transport. The actual executor's review
was relayed with verified receipts: topology matched, and four documentation/
example corrections were requested. This update makes config/input locations
explicitly external, uses `review` for read-only inspection, describes the
fixture's `output/` directory reservation and documents actual bounds/no renewal.
Runtime behavior is unchanged. The actual Claude coordinator subsequently read
the skill plus roles, topology, workflow, handoff and selected adapter sections
at the licensed checkpoint. It confirmed the model, reported no access blocker,
and supplied host-specific scheduling/messaging observations plus handoff and
resource corrections. It did not read scripts, tests, protocol or provenance;
this is a workflow review, not its approval of runtime correctness or release.
The adapter reference now distinguishes observed desktop behavior, host tool
documentation and portable toolkit capabilities. Both actual lane reviews are
complete; neither substitutes for publication authority or a live adapter test.

This follow-up also exercised the shipped read-only request from external
private config/input files. Config-relative roots resolved there, a concurrent
write reservation could coexist with the review, and the input source stayed
unchanged. A synthetic clock check confirmed the 3600-second default claim and
86400-second message TTL; status/check, ACK/note and same-key claim retries did
not renew either deadline.

Under contention, the old distinct-send test twice received the documented
busy exit code 4 rather than immediate success for every sender. The test now
permits one same-key caller retry after its competing transactions settle,
then repeats successful action keys and verifies exactly three messages,
idempotency records and delivery events plus a complete snapshot with no partials.
The engine's lock/retry bounds were not changed. This checks bounded busy
handling without promising every simultaneous write will succeed immediately.

An independent follow-up used a fresh temporary snapshot and passed the
focused contention check, all 40 tests and structural/link/source-hash checks.
It found no material blocker in the corrected source and verified that host
observations and external seam/resource agreements are not toolkit guarantees.
Diagram source was reviewed for roles and boundaries; rendered pixels were
not independently checked in this follow-up.

At the initial checkpoint, the selected Python lacked PyYAML when the official
skill-creator validator was attempted; no dependency was installed. The later
observed-practice follow-up used an already installed Python 3.12 and passed
that official validator. This public validation modified no installed skills.
The package's dependency-free fallback validates its authored simple frontmatter,
skill name, UI invocation, local reference links and scaffolding. It is not a
general YAML parser. Behavioral proof comes from executable mailbox tests and
an independent forward pass, not that structural fallback.

## Observed-practice follow-up

Selected authorized internal receipts supported active-copy convergence and
partial coordinator adoption, with other candidate/tool receiving still pending.
The public guidance generalizes ready-work integration, actual owner activation,
independent queues, low-cost criticism, incremental tool reuse and preserving
current owner edits. It does not copy private inventories or claim all internal
adoption, native acceptance, or resolution of an open proposal/approval finding.

The synthetic delivery ledger is illustrative, not CLI input or an enforced
state machine. The read-only demo now uses `review` and returns its actual
request kind and pinned source hash. Its ACK names read scope without a write
reservation. A fresh temporary snapshot passed all 40 tests and both the
structural/link/hash check and official skill validation. A separate example
probe passed Codex-only, Claude-only and mixed modes: real synthetic delivery/
ACK/pinned-result evidence was retained while host activation stayed unverified
and receiving, admission, joining, serving and experience acceptance stayed
pending. These fixtures start no live agent, server, scheduler or GPU workload.
An independent read-only forward review repeated all 40 tests, the structural
check and three demo modes, and confirmed the exact diagram and preserved
core/adapter/license bytes. The official validator PASS was a separate run.

The core, CLI, legacy adapter, MIT bytes and accepted README diagram are
unchanged. Source-workflow inventory/correction helpers are not added to this
package; their own source-ready tests do not establish receiving or activation.

## Limits and release review

Only this Windows local-filesystem environment was exercised. Node 22+ is the
declared minimum, not a tested matrix. Linux, macOS, network filesystems, power
failure, large-scale throughput and malicious same-user editing are untested.
The complete snapshot retains messages, audit events and idempotency records;
no automatic compaction/retention policy is implemented. Use it for bounded
local projects, not an indefinitely growing distributed service.
Engine fixtures prove distinct Codex-only, Claude-only and mixed labels can use
the transport; they do not prove live host session activation, discovery or ACK.
Separately, the owner reports a functioning Claude-coordinator/Codex-executor
setup with interactive session-created background checks/interval activation,
primarily PR/comment coordination and local mail for sensitive handoffs.
Current local sources describe that approach, and official Claude Code docs
describe session scheduling. This update documents that evidence without a
live scheduling/API/lifetime test; the demos register no host tasks. CLI
unsupported wake/stop results apply to toolkit-native controls, not external
host capabilities. See [host-owned receiving](adapters.md#interactive-claude-session-background-receiving).
The optional PR workflow has no automated posting adapter and was not exercised
against a third-party PR by this package's tests. The private repository creation is package delivery,
not a test of PR messaging.

The release scanner inspects staged blobs, all reachable Git commit trees and
commit subjects/bodies
for credential signatures, personal absolute paths, caller-supplied private
terms, oversized files and unexpected generated artifacts. It is heuristic:
human source/provenance review remains necessary. No private mailbox states,
tokens, logs, local configuration or session evidence belongs in this tree.

The owner approved MIT licensing with the stated copyright attribution;
source provenance and retained comments remain recorded. Before future public updates,
review rights/notices for any newly added external content, repeat privacy
and history scans, test any newly claimed platform/host adapters, and decide
whether the retained legacy compatibility script remains useful. Toolkit-native
session wake/stop remain unsupported until a tested adapter is added; existing
host-owned timers/notifications are separate capabilities.
