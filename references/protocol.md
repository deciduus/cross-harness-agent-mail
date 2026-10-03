# Generalized local mailbox protocol

## Configuration and identity

Use a private config copied from `examples/config-*.json`. `version` is 1;
`projectRoot` and `mailboxDir` are external paths (relative values resolve from
the config file). `allowedScope` lists project-relative files or directories.
`participants` maps unique IDs to `role` and `engine`; `operator` identifies the
operator role. IDs are case-sensitive labels, not authenticated identities.
Each claiming session also supplies a distinct label. Never reuse one session
label concurrently. Engine values do not alter permissions or wake sessions.

The manual adapter reports delivery support and unsupported session wake/stop.
These capabilities describe this toolkit's adapter, not separately configured
host timers or notifications; see [host-owned receiving](adapters.md#interactive-claude-session-background-receiving).
Limits bound leases, TTL, body/ref size and hops. The core performs no external
messages, jobs, installation, process killing or source-file edits.

## Defaults, bounds and expiry

These values come from `createMailbox` and the shipped example configurations.
Omitted limit fields use the core defaults; per-action durations can be shorter.

| Setting | Default/configured maximum | Hard ceiling |
| --- | --- | --- |
| `maxLeaseSeconds` | 3,600 seconds (1 hour); also the default claim/accept lease | 86,400 seconds (24 hours) |
| `maxTtlSeconds` | 86,400 seconds (24 hours); also the default message TTL | 604,800 seconds (7 days) |
| `maxBodyBytes` | 204,800 bytes (200 KiB) of UTF-8 body | 1,048,576 bytes (1 MiB) |
| `maxRefBytes` | 10,485,760 bytes (10 MiB) per referenced file | 20,971,520 bytes (20 MiB) |
| `maxHops` | 3; reaching the configured threshold routes to the operator | 3 |
| Reference count | At most 64 per message | Fixed, not a `limits` option |

Limit overrides must be positive integers within their ceilings. Claim duration
starts at claim/transfer acceptance; TTL starts at message creation. The example
below deliberately uses a 600-second lease and 3,600-second TTL. Inspect returned
`claim.leaseUntil` and `expiresAt`, rather than assuming every packet has defaults.

There is no renewal or heartbeat operation. Host interval checks, notifications,
ACKs, notes and idempotent claim retries do not extend a lease or TTL. An accepted
transfer creates a new claim lease but retains the original message expiry;
it is not a renewal API. Keep each work slice within both deadlines. On expiry,
checkpoint and follow explicit operator reconciliation/recovery after verifying
the previous worker has stopped; do not continue or steal the expired claim.

## CLI

All actions accept JSON input files; outputs are JSON. Keep config, input JSON,
token-bearing outputs and state in your private workspace outside the installed
skill and version control. The commands below assume a sibling
`coordination-private/` folder; adjust to the actual external location. Run from
the package directory; operational private files live elsewhere:

```sh
node scripts/mail.mjs capabilities --config ../coordination-private/local-config.json
node scripts/mail.mjs init --config ../coordination-private/local-config.json --input ../coordination-private/init.json
node scripts/mail.mjs send --config ../coordination-private/local-config.json --input ../coordination-private/review.json
node scripts/mail.mjs check --config ../coordination-private/local-config.json --input ../coordination-private/check.json
node scripts/mail.mjs claim --config ../coordination-private/local-config.json --input ../coordination-private/claim.json
node scripts/mail.mjs reply --config ../coordination-private/local-config.json --input ../coordination-private/ack.json
node scripts/mail.mjs reply --config ../coordination-private/local-config.json --input ../coordination-private/result.json
node scripts/mail.mjs done --config ../coordination-private/local-config.json --input ../coordination-private/done.json
```

`--config` and `--input` paths resolve from the invocation's working directory.
Within config, relative `projectRoot`/`mailboxDir` resolve from the config file's
directory; scopes/refs resolve within that project root. Copying a template to
the private folder changes where its relative roots point: configure them
before using the CLI, never let them create state inside the installed skill.

Use the demonstrated parser order; run `node scripts/demo.mjs` for an executable
synthetic pass. Example action inputs:

```json
{"actor":"operator"}
```

The first input is for init. Dispatch:

```json
{"from":"coordinator","to":"builder","kind":"review","body":"Ask: inspect source without editing it. Done when: focused check and evidence. Stop if: new permission is required.","scope":["src/"],"refs":["src/sample.txt"],"ttlSeconds":3600,"idempotencyKey":"packet-a"}
```

Claim:

```json
{"actor":"builder","session":"work-session-a","id":"MESSAGE_ID","leaseSeconds":600,"idempotencyKey":"claim-a"}
```

Carry the returned `message.claim.token` into subsequent actions. ACK (reply):

```json
{"actor":"builder","session":"work-session-a","id":"MESSAGE_ID","token":"CLAIM_TOKEN","kind":"ack","body":"Receipt: packet-a; target: work branch; reservation: src/; next: focused inspection.","idempotencyKey":"ack-a"}
```

Result (reply), then `done` with the same actor/session/id/token and a new key:

```json
{"actor":"builder","session":"work-session-a","id":"MESSAGE_ID","token":"CLAIM_TOKEN","kind":"result","status":"ok","body":"Evidence: command, result, exact tested commit; next owner: coordinator.","idempotencyKey":"result-a"}
```

`check` takes `actor`; `read` takes `id`; `status` and `capabilities` require no
input. `validate-path` takes `path`. `wake` and `stop-session` return unsupported
without invoking session tooling. The API is `createMailbox(config, {clock?})`
from `scripts/mailbox.mjs`, then `execute(command, input)`; the test-only clock
allows deterministic expiry tests without waiting.

Exit codes: **0** success; **2** refused/invalid; **3** STOP; **4** busy;
**5** unsupported. CLI JSON includes `ok` and `code` so a caller need not parse
prose. No retry on refusal/STOP/unsupported. Busy uses bounded lock retry, then
returns to the caller. A later authorized retry reuses the same action key.

## Envelope and lifecycle

The [message schema](message.schema.json) describes stored envelopes. Dispatch
pins references by full SHA-256. Read/claim/transfer-acceptance diagnostics identify changed refs;
they do not silently rewrite a packet or authorize altered dependencies.
Paths are validated again on consumption. Scope is an instruction/reservation,
not a filesystem sandbox. Do not execute bodies as code.

Use `kind: review` for read-only inspection, with `scope` naming inspected paths.
It can coexist with a writer and creates no write reservation. A claimed
`request` reserves its write scope; choose it for authorized editing, not merely
to inspect a file. These labels do not authenticate an agent or sandbox edits.

A request/review moves `new` → `claimed` → `done` after a terminal result. ACK and
note are nonterminal receipts; result status is `ok`, `partial`, `refused`, or
`needs-human`. Results/ACK/notes expect no replies. Only a valid current claim
holder may reply or finish, including same-owner retries from the same session.
Terminal reply chains are refused. Repeated action keys return the original
committed result, rather than creating another envelope or claim. Reusing a key
for different input is refused. Do not equate mailbox done with integration.

Message TTL bounds work availability; expiry is not permission to reassign a
running worker. Expired work is marked dead when a lifecycle action observes
it. A dead write request's retained claim continues to reserve its scope until
explicit operator recovery. Expired work/leases cannot finish; the operator
must reconcile/recover after the lease expires.
Claims record owner/session/token/deadline. Active write reservations reject
overlapping executor scopes, including directory/file overlap. External owners
and declared symbol/hunk sharing still need a human-readable reservation ledger.

## Transfer and stale recovery

`offer` takes current `actor/session/id/token`, `to`, `reason`, and action key.
`accept` takes receiving `actor/session/id/offerId` and action key. Acceptance
records a receipt, transfers the claim and issues a new fencing token. The old
holder cannot reply/done afterward. There is no decline/cancel CLI command;
the receiver can report refusal and leave the offer unaccepted. The original
holder retains custody. An abandoned offer requires operator reconciliation
and recovery after lease expiry; do not guess a replacement command.
Preserve exact source custody and
all prior evidence when transferring a source task.

Acceptance revalidates the scope and pinned references before changing custody.
Unavailable references refuse the action and preserve the old owner/offer;
changed references are returned as diagnostics, requiring the receiver to
reconcile affected evidence. Every refused mutation preserves the prior task
state while recording its refusal and idempotency key.

`recover` takes operator `actor`, `id`, explicit `reason` and key, after checking
the old worker is stopped. A stale unanswered claim can return to new; answered
work must close without reexecution; expired work stays terminal and recovery
releases its retained custody. No automatic
claim stealing is implemented. Fencing protects mailbox operations, not a rogue
or still-running source editor.

## Atomicity, retry and STOP

Every mutation acquires `.lock` through exclusive file creation (`wx` / CreateNew),
then writes a complete temporary state, flushes it, and atomically replaces
`state.json`. The durable idempotency record and lifecycle update commit in the
same snapshot. Readers never consume temporary files. Rename publishes state;
it is not the exclusive claim lock. The global lock serializes short mailbox
transactions, not the work performed by executors.

A crash can leave `.lock` or temporary files. There is no automatic stale-lock
deletion. Status exposes the lock; an operator must first quiesce/verify writers,
inspect the state and only then remove that specific abandoned transaction lock.
Do not infer abandonment from age. Local atomic visibility is tested; arbitrary
power-loss durability, network shares and hostile concurrent edits are unproven.

`stop`/`resume` take operator `actor`, `reason` and action key. STOP blocks normal
mutations and check; status/read remain available. A saved idempotent reply can
describe an already committed action, but grants no permission to continue work
while stopped. Mailbox STOP cannot interrupt a currently editing session.

The third agent-to-agent hop routes to the configured operator; operator-origin
requests reset hops. This supplements the terminal-reply rule, not permission
to create endless fresh threads. Each skill pass is bounded by assigned work,
claim lifetime, retry bounds and actual user authorization.
