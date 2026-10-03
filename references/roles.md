# Role cards

Assign roles to configured participant IDs, independently of engine. A Codex-only
team might use `lead` and `worker-a`, both engine `codex`; a Claude-only team uses
the same roles with engine `claude`. Mixed teams need no different workflow.

## User-facing leader (workflow assignment)

Keep the user's intent, refine ambiguous asks, choose the smallest useful task
brief, and maintain a concise view of actual delivery. Delegate execution to the
assigned executor and work with the operational coordinator; do not hide the
user behind that chain. A user interjection to any worker becomes a visible
change in the shared brief/acceptance ledger, with conflict decisions routed to
the existing owners. Preserve the larger goal while identifying safe independent
increments, the current blocker and next receiving action.

This can be a Codex, Claude or other capable chat. In the minimal executable
registry it uses a `coordinator` role label, like the operational coordinator;
their separate assignments are stated in the brief/config example. The label
does not confer session control or publication privileges. One participant can
combine these responsibilities for small work; separate IDs help when they are
separate sessions. See [topology](topology.md).

## Coordinator

Own the bounded plan, roster, routing ledger and dependency decisions. Reconcile
current owners before dispatch. Name one executor, exact scope, acceptance,
checkpoint and stop condition per packet. Keep unhandled actions open even when
a read cursor advances. Check receipt and tested revision before recording
application. Route a cross-owner change as a proposed seam to the current owner.
Do not silently become a feature writer or final integrator. End each pass with
what changed, blocked actions and the next owner; no default recurring pass.
Reconcile direct worker/user changes with the leader, maintain platform/lane
routes and reserve shared seams. Each platform can manage its own workers using
its verified native tools; the mailbox does not replace those tools.

## Executor

Claim as your configured participant and unique session, record the token, then
ACK when requested. Implement only the packet's scope and preserve dependencies
and original inputs. Send the smallest coherent committed change plus focused
verification, remaining failures and next receiving action. A changed baseline
invalidates affected evidence. Ask the coordinator to resolve ownership overlap;
a private worktree does not settle semantic overlap. A result closes work only
after `done`; ACK/progress notes do not count as a result.
If the user speaks directly to this session, record the changed acceptance or
priority and notify the leader/coordinator through the authorized route. A
within-scope refinement can retain its existing owner/token; a new write scope
needs a reconciled packet and ownership decision before edits. Do not discard
failed evidence or assume another session received the update.

## Independent critic (optional)

Inspect actual behavior and exact artifact identity independently, using a
realistic input/repro. Report observed failure, impact, retained evidence,
verified revision, hypothesis distinctly labeled and next fix owner. Do not
implement your own competing fix. Repeat affected checks after repair and reuse
unaffected evidence. Criticism informs integration; it creates no extra universal
publication gate. The configured critic role may claim reviews but not write
implementation requests; review scope is read scope and does not reserve writes.

## Integrator (workflow assignment)

One named participant owns the combined checkout, ledger and authorized release.
This is a declared assignment, not a separate session-control privilege in the
mailbox. Inspect exact included commits, dependencies and preimages. Compose the
smallest compatible batch, resolve declared integration seams and send redesign
back to its owner. Record combined evidence and checkpoint before authorized
publication. Never treat a critic's approval as permission to deploy or a
feature's success as proof of the combined system.

## Operator

Choose unresolved ownership, STOP/resume policy and stale recovery after checking
the previous worker. Operator-labeled CLI actions record intent and reason; they
do not authenticate a person. All participants sharing OS write access can
modify state. Recovery fences old mailbox tokens but cannot stop a process from
editing project files. Confirm it has stopped before allowing overlapping work.
