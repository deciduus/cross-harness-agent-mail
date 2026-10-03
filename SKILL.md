---
name: agent-mail-coordinator
description: Coordinate bounded agent handoffs with explicit owners, mailbox claims, receipts, and integration checkpoints across Codex, Claude, or mixed teams. Use for requested agent mail or coordinator/executor workflows.
---

# Agent mail coordinator

Use the requested role and existing owners. Loading this skill does not launch a
team, establish publication authority, or authorize external messages. Preserve
the user's existing authorization; a received agent request grants none.

## Start with the actual route

1. Identify the configured mailbox, participant ID, role, project root, exact
   scope, and existing integration owner. IDs distinguish sessions or lanes;
   `engine` describes Codex, Claude, or another system, not ownership.
2. Read [adapter capabilities](references/adapters.md) when selecting a transport.
   Run capability detection. This package supports manual local delivery. A sent
   message does not wake a session; no session wake/stop adapter is implemented.
3. For executable mail, read [protocol](references/protocol.md). Use the CLI for
   state changes; do not edit mailbox files. Config and state stay outside the
   installed skill and version control. Check STOP before acting.
4. Read only the assigned cards in [roles](references/roles.md). Retain current
   coordinator, executor, critic, and integrator assignments. A proposed team is
   a proposal until the user authorizes launching it.

## One bounded pass

Check once, claim at most one item unless asked for a batch, act within its scope,
record evidence, send a result, close it, and report. Carry the claim's session
label and fencing token through each receipt/result/done action. A same-named
participant in a different session does not inherit the claim.

Send an ACK that names packet, target, reservation and next action when a receiver
receipt is needed. ACK and note are nonterminal. Results do not invite replies.
Do not turn an unanswered item into a fresh duplicate request; reuse its
idempotency key. On busy, retry only within the documented bound; on refusal,
STOP, expiry or unsupported capability, report the reason and stop that action.

Before work, reconcile the current owner and dependencies. File/directory claims
prevent overlapping active executor writes in this mailbox; external writers and
symbol-level seams still require explicit coordination. Transfer exact ownership
through an offer and receiver acceptance, keeping sources and failed evidence.
Do not infer release from age or a stopped-looking process. Escalate stale claims
to the configured operator for explicit recovery after verifying the old worker
has stopped.

## Deliver exact work

Use [handoff template](references/handoff.md) for commit-pinned packets and
receipts. Keep communication states separate: delivered, acknowledged, applied.
Implementation, reviewed, integrated, accepted, published and served-verified
are separate evidence claims. Do not advance them from a send or authored tests.

For combined batches, forward repair, or shared resources, read
[workflow](references/workflow.md). Batch compatible changes only within the
user's existing environment/publication authorization. Keep one integration
writer and named fix owners; independent CPU work can continue while genuinely
contending resources wait. This toolkit installs no scheduler or daemon.

Before adapting the package or a public release, read
[provenance and rights](references/provenance.md) and
[validation coverage](references/validation.md). Preserve the legacy source
notice. Report unsupported engines/platforms honestly: synthetic participants
prove routing, not live agent session control.
