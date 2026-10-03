# Agent mail coordinator

A small skill and file-mail toolkit for user-facing leaders, coordinators,
executors and their workers.
Use separate participant IDs for Codex-only, Claude-only, mixed, or other-agent
teams. It carries work and receipts; people or the host agent system activate
sessions. It does not run agents, install daemons, poll, or schedule jobs.

**Private review package. No open-source license is granted.**
See [provenance and rights](references/provenance.md) before redistribution.

## Why this exists

This started while the owner was coordinating Codex and Claude on a complex
game project. Work was happening in several places, but handoffs were easy to
miss, two workers could approach the same file, queues could sit idle, and a
finished piece did not always reach the integrated result.

The useful idea was small: give work an address, one owner, a receipt and a
clear return path. The user mainly chats with a leader who refines the request
and delegates a useful brief. In the originating setup that Codex-side leader
is **dot**; it could instead be a leader chat in Claude or another capable host.
Executors work with an operational coordinator, currently Claude Code in that
setup but replaceable. Each platform can manage its own workers through its
verified native tools. Mail and exact handoffs connect those teams.

Role and product are independent. Leader is not a Codex-only privilege,
coordinator is not a Claude-only product, and an executor may manage workers on
either side. The user can talk directly to any session or worker. New direction
is recorded and reconciled with the leader/coordinator and current file owners;
it must not silently widen a claim or disappear in a separate conversation.

```mermaid
flowchart TB
  U[User] --> L[Leader: refine intent]
  L -->|useful brief| E[Executor]
  E <-->|ownership and handoff| C[Coordinator]
  E --> A[Platform A workers]
  C --> B[Platform B workers and critic]
  A <-->|manual agent mail| B
  U -. direct instruction .-> A
  U -. direct instruction .-> B
  A -. reconcile change .-> L
  B -. reconcile change .-> C
  E --> R[Exact result and evidence]
  R --> I[Existing integrator]
  I --> V[Verified combined artifact and visible status]
  H[Person or verified host: activate sessions] -.-> E
  H -.-> C
```

Sending a packet is delivery. It does not activate another session or prove
receipt. Status, named lanes/sessions, ACKs and artifact identities make progress
inspectable; active badges and posted plans do not prove an integrated result.
The package supplies local status and receipt data, not a universal dashboard or
cross-platform agent manager. See [topology](references/topology.md).

The same shape can help a software build/test team, a researcher handing a
source-backed draft to a reviewer, or a production workflow moving a prepared
asset to its assembler. Those are workflow examples, not claims of tested
domain integrations. This package's executable proof uses synthetic participants
and local files.

| Example setup | Participant engines | What is supported here |
| --- | --- | --- |
| Codex-only build and review | Codex lead + separately named Codex workers | Same manual mailbox and ownership contract |
| Claude-only research and edit | Claude lead + separately named Claude workers | Same manual mailbox and ownership contract |
| Mixed production handoff | Codex lead + Claude executor (or the reverse) | Same routing; engine does not select the owner |
| Another agent host | Configured `other` participant | CLI boundary; host skill discovery/session control needs its own test |

Human control stays with the existing user and host: mail grants no permission,
STOP halts ordinary mailbox actions, ownership changes need acceptance, and
stale recovery requires an explicit operator decision. The toolkit labels roles;
it does not authenticate people or sandbox source edits. A future tested adapter
could wake a specific supported session or carry an envelope through another
transport. It must report those capabilities separately and preserve the same
receipt and ownership rules.

## A complete handoff, including a user interjection

For a synthetic catalog job, the leader asks an executor to normalize labels.
The executor and coordinator reserve an output file and hand it to a named
worker. The user then tells that worker, “Keep the original label too.” The worker
checkpoints its work, records the changed acceptance and sends an update upward.
That refinement fits the same output reservation; another requested file would
need a new ownership decision and packet before editing.

A reviewer finds the first candidate lost original labels. The failed candidate
and RED evidence stay retained. The same named forward fixer repairs it, the
same reviewer checks the affected behavior, and the existing integrator copies
the passing bytes into the combined result. The user sees the reconciled
direction, ACKs, RED→PASS repair, integrated hash and remaining limitations.
This is actual synthetic file processing, not a recorded conversation or a live
agent trial. [Worked example](references/worked-example.md) shows the steps and
sequence diagram; the runnable demo makes the evidence observable.

## Try it

Requires Node.js 22 or later. There are no npm dependencies or install scripts.
From this directory:

```sh
npm test
node scripts/demo.mjs
node scripts/topology-demo.mjs mixed
node scripts/topology-demo.mjs codex
node scripts/topology-demo.mjs claude
node scripts/topology-demo.mjs mixed --outside-direction
```

The tests and demo create isolated synthetic mailboxes, never contact live
agents, and clean their own temporary data. The demo shows coordinator dispatch,
executor claim, ACK, result, completion and an unsupported wake request.
The topology demo additionally simulates separate platform workers, direct user
direction, reconciliation, retained failure, forward repair and integrated-byte
verification. It does not launch workers or receive real host chat events.

Copy one of `examples/config-mixed.json`, `examples/config-codex.json`, or
`examples/config-claude.json` into your own project-local private configuration.
`examples/config-topology.json` illustrates separate leader/coordinator/executor
assignments. Its `workflowAssignments` field is descriptive metadata; leader and
integrator use existing coordinator role labels, not new execution privileges.
Set its project/mailbox roots and allowlist to your project. Keep local config,
claim tokens, mailbox state and evidence out of the repository. CLI usage and
exit codes are in [protocol](references/protocol.md).

## Install the skill

Copy this directory into a skill directory supported by your host, named
`agent-mail-coordinator`. For Codex, the usual user directory is
`~/.codex/skills/agent-mail-coordinator`; for Claude Code it is
`~/.claude/skills/agent-mail-coordinator`. These are manual installation examples;
no existing skill is overwritten by this package. Confirm your host discovers
the top-level `SKILL.md`, then invoke it by name through that host's supported
mechanism (`$agent-mail-coordinator` is the Codex example). Other hosts can
consume `SKILL.md` and use the same CLI, subject
to their own tool and permission model.

The directory remains self-contained: scripts and references are relative to
the skill. Machine/project configuration remains external. Installing a skill
does not connect it to another session or authorize public GitHub comments.

## Small architecture

`SKILL.md` routes the agent to role/workflow references. `scripts/mail.mjs` is a
JSON CLI around `scripts/mailbox.mjs`. The core commits a whole state snapshot
under a bounded exclusive file lock, with durable idempotency and session-fenced
claims. [message.schema.json](references/message.schema.json) describes the
stored envelopes. [adapters](references/adapters.md) separates local transport
from session control and optional manual PR handoffs.

`adapters/legacy-mail.ps1` retains the inspected Windows Codex/Claude trial script
byte-for-byte. It has its own original protocol and limits; use it only for an
existing trial-format mailbox, never against the generalized state directory.

See [private review findings](references/public-review.md) and
[tests and platform limits](references/validation.md) for what was actually
run. This is local same-user coordination, not a distributed queue or an
authentication/sandbox boundary.
