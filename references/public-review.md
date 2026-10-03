# Private review of version 0.2.0

This update remains a private inspection package under the owner-approved
[MIT license](../LICENSE). It has not been made public. The initial mailbox/legacy behavior is retained; the
update makes the actual human workflow easier to inspect and test.

## What changed and why

The earlier package began at coordinator-to-executor routing. The current
entrypoint and diagrams include the user-facing leader, useful delegated brief,
separate operational coordinator and each platform's native worker team. Roles
do not select products. Direct user direction to a worker is recorded and
reconciled without losing the original goal or silently widening write custody.
Installing or invoking this skill does not grant session or source permissions.

The runnable example processes synthetic labels, retains failed review bytes,
returns RED to the leader, passes that evidence to the coordinator, repairs with
the current writer and rechecks with the same reviewer. The current output
custodian saves reviewer evidence; the critic remains a read-only lane. The
existing integrator claims released output and checks the combined artifact's
actual bytes. An outside-scope proposal is held and reported, rather than
silently counted as completed.

Independent inspection caught an incomplete-work receipt bug: the held
outside-scope request still received an `ok` result. Both user-facing receipts
now report `partial`, name the leader as pending owner and state the next
ownership-reconciliation action. Independent retained-envelope and artifact
checks confirmed that correction; the original safe artifact still passes.

The latest inspected coordinator fragment adds host-specific messaging limits
and batching. Portable guidance keeps concise batched pointers and individual
ownership receipts. It excludes numeric host caps, automatic schedules, native
control commands, private destinations and live project constants. Provenance
records current and prior source hashes without copying their private content.

The release scan now checks commit messages and POSIX/escaped Windows paths as
well as staged and historical trees. Runtime artifacts and oversized/generated
files remain excluded. This is a heuristic review aid; it cannot establish
source rights or prove the absence of every secret.

## What inspection establishes

The dependency-free Node suite, Windows legacy smoke and simple skill/link
validator exercise local fixtures only. Manual installation examples use the
host's skill directory and discovery mechanism; no installed skill was changed.
Example configurations keep machine roots and participants external. Workflow
assignment metadata is descriptive, not new core authorization. See
[validation](validation.md) for exact checks, hashes and platform limits.

The manual CLI is a sensible boundary for other hosts capable of reading the
skill and running local commands. No universal plugin compatibility, automatic
chat interception, toolkit-native wake/stop or native worker discovery is claimed. Mailbox
STOP does not interrupt an active source editor. These are separate capabilities
that need actual host-specific adapters and evidence.
The owner separately reports that an interactive Claude coordinator configures
background checks/interval activation to stay synchronized with a Codex
executor, primarily on PRs/comments with sensitive local-mail handoffs, and
dot / an interchangeable lead chat holding direction and
reconciling findings. This host-owned receiving setup needs no pre-existing
Claude Routine. The local sources and host documentation support the approach;
its exact running host APIs/lifetime were not independently validated. See
[adapters](adapters.md#interactive-claude-session-background-receiving).

## Decisions before a public release

1. Preserve the owner-approved MIT attribution and inspected source provenance;
   verify rights/notices for any newly introduced external content.
2. Review the exact intended Git history, authors and artifacts again for
   private material. Keep local configuration, receipts/tokens and live logs out.
3. Test every newly claimed operating system, filesystem and host adapter. The
   current evidence is Windows local-filesystem and synthetic engine labels.
4. Decide whether to keep the legacy compatibility script, whose original
   mailbox format and weaker limits are separate from the generalized core.

The skill-creator's official validator remains unavailable because its installed
Python lacks PyYAML; the documented simple structural fallback is narrower.
Public-readiness work does not remove that limitation. The owner's MIT choice
is recorded in [provenance](provenance.md); actual executor/coordinator feedback
and explicit publication approval remain separate.
