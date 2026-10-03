# Transport and session capability boundary

| Route | Capability | Toolkit-native session control | Evidence |
| --- | --- | --- | --- |
| Generalized local file mailbox | Send/check/claim, fenced completion, receipts, transfer/recovery | None | Synthetic process tests on Windows |
| Codex manual consumer | Configured participant + CLI | None | Routing tested; no live Codex session trial |
| Claude manual consumer | Configured participant + CLI | None | Routing tested; no live Claude session trial |
| Interactive Claude host scheduling | Session-created background checks/interval wake | External to this toolkit | User-reported Claude coordinator/Codex executor setup; host docs, no independent live-host test |
| Other manual consumer | Arbitrary configured participant + CLI | None | Same routing contract; host-specific discovery untested |
| Original PowerShell trial | Original Codex/Claude file protocol | None | Windows synthetic lifecycle/claim tests |
| GitHub PR comments | Human/authorized host-tool delivery | None | Optional documented route; no automated posting adapter |

Use capability detection before selecting a route. Executable capability output
must distinguish `delivery`, `wake`, and `stopSession`. Installed executables or a
reachable mailbox do not prove a session can receive a wake-up. Unsupported
wake/stop requests to this toolkit terminate with an unsupported result; no guessed queue,
message, cron or process command is attempted.
The CLI's `wake: false`/`stopSession: false` describe its manual adapter only.
They do not disable or deny a host's independently configured session timers,
background notifications or controls.

To add another agent, configure a unique participant ID, role and `engine: other`
and have an explicitly activated session consume the CLI. To add real session
control later, implement an explicit adapter whose supported operation returns
an evidence-backed receipt; test it in an isolated authorized host. Keep routing,
acknowledgement and session control separate. Do not advertise support based only
on executable detection. No such control adapter ships here.

## Interactive Claude session: background receiving

The owner reports that their Claude coordinator stays synchronized with a Codex
executor through session-created background checks and interval wake-ups over
primarily PR/comment coordination, plus local mail for sensitive handoffs.
The lead chat (dot or another lead agent) keeps project direction and reconciles
their findings. The inspected coordinator sources explicitly describe an
interactive session cron, delta checks and background-completion notifications.
They distinguish that session from unattended scheduled tasks; the source's
message-tool restriction is host-specific, not a universal Claude Routine rule.

An interactive session with those host tools can configure receiving itself;
it need not begin with a pre-existing Claude Routine. A conceptual setup request:

> Set up host-supported interval checks of my agreed PR coordination thread
> and configured private coordinator mailbox, correlating the same packets.
> Confirm the participant, cadence, task identity and stop condition. Each
> activation checks once, handles only authorized work with normal claims and
> receipts, and returns idle when nothing changed. Cancel at closeout.

Choose cadence with the user and available host. Verify the registered task in
that host and an actual receipt on the first activation; a setup proposal is
not proof it runs. Background completion notifications are another host route.
No task is registered by this package or its demo.

[Claude Code's scheduling documentation](https://code.claude.com/docs/en/scheduled-tasks)
describes `/loop` and `CronCreate` within a session, separately from cloud
Routines. Local execution requires Claude Code to keep running; due prompts
wait for an idle turn and missed intervals do not replay individually. Its
current recurring-task expiry is seven days. Resume restores eligible cron
tasks with exceptions; background Bash/monitor tasks are not restored. These
are documented Claude Code limits, not guarantees for every Claude host/version.

Exact tool schemas, notification hooks and lifetime of the owner's running
arrangement were not independently inspected or tested. Verify them in that
host. No generic cross-host wake/stop adapter is implied, and mailbox arrival
alone cannot activate another agent.

## Claude manual consumer: efficient passes

The inspected Claude coordinator variant added a delta-first pass, fewer active
waiting turns, completion-only notifications, a CPU backlog and narrower critic
rechecks. These ideas apply to any engine; for a Claude session using this skill:

- Read the current `engine: claude` participant, role and available tools. Use
  the same CLI and fencing token contract; never impersonate a different lane.
- Read new or changed packet/status evidence first, then open the full bodies
  only for actions that need attention. A read cursor does not resolve an open
  action; keep unresolved ownership, ACK and application steps visible.
- Do useful independent CPU work while a resource or ACK is pending. If none
  remains, checkpoint and return control. Do not spend repeated model turns
  checking the same inbox or lease. A configured host interval can trigger a
  later bounded pass without an active waiting loop.
- Use a host's background-completion notification only when that capability is
  actually present and authorized. Prefer one final completion/failure receipt
  over progress messages that repeatedly activate a session. This manual
  adapter provides no notification or wake mechanism itself.
- Report a delivery, blocker, decision or changed evidence; omit repeated
  "still waiting" messages. Keep critic rechecks focused on changed areas and
  affected controls; broaden discovery when requested or materially justified.
- Check the actual host's communication budget before using a native session
  pointer. Batch related pointers, keep direct messages for owner-specific asks,
  and use one authorized durable broadcast when it reaches the intended owners.
  Preserve separate per-owner receipts. A quota or unavailable pointer leaves
  delivery/activation pending; it does not justify repeated retry turns.

The source's fixed cron cadence, delta-script paths, GPU commands, session names,
PR destinations, tool hooks, machine limits and billing/token anecdotes remain
project/host-specific. No cron or recurring job is installed or authorized by
this adaptation. Existing source bytes were preserved; the refreshed source hash
is recorded in [provenance](provenance.md).
The latest source also contains a particular desktop messaging cap; its numeric
limit is not a portable capability claim or a setting enforced by this package.
The batching principle above is generalized; re-discover the actual host limit.

## Optional PR route

Use existing authorized host GitHub tools or authenticated CLI when the user
requests that communication and there is an appropriate existing PR. Verify the
actual repository/PR/head, current owner and latest relevant comments first.
Reuse the packet key and check for an existing post before creating a duplicate.

Post only a sanitized repository-relative packet: sender role, recipient owner,
requested action, exact source head, paths, checks, limits and next checkpoint.
Read back the saved comment and record its ID as posted. A real receiver reply
establishes acknowledged; a tested applied commit establishes applied. A pointer
to another session requires a separately tested and authorized host capability.
PR transport remains optional; local file mail works without GitHub.

## Using local mail and PR comments together

In the owner's reported workflow, PRs/comments are the primary shared
coordination surface, and local mail carries sensitive or machine-local payloads.
Across hosts, repository access does not provide access to someone else's
filesystem. Consumers of one file mailbox need the same permitted mailbox
location; this package has only local Windows filesystem evidence, not tested
network shares or cross-host replication. Use an agreed authorized private
handoff channel when that filesystem is unavailable; no such transfer adapter
ships here. Local mail is not encrypted or authenticated by this toolkit;
privacy depends on filesystem/account permissions and how recipients handle it.

The bridge is an authorized person or agent using the CLI and existing host
GitHub tools, not an automatic GitHub transport in `scripts/mail.mjs`:

1. Choose one canonical shared coordination ledger for the task, such as the
   agreed PR/thread. Keep its direction revision, current owner, acceptance and
   latest decision clear. Private payloads and local claim state stay in their
   designated private mailbox; a PR summary does not replace or steal custody.
2. Give the handoff one stable packet key. Record the PR/comment identity and
   source head privately with the mailbox ID; put only the non-sensitive packet
   key, scoped ask, owner, code refs and approved status on GitHub. A private
   path or token is not a safe public correlation pointer.
3. Before relay, check the packet key, prior comment/receipt and latest source
   head. Reuse the local idempotency key for the same action and reconcile an
   existing PR post instead of creating a second independent task/queue.
4. Consume the private packet with normal claims and acceptance. Relay a
   sanitized receiver ACK and later exact tested result to the agreed thread;
   keep posted, acknowledged, applied and integrated distinct. Do not copy the
   mailbox state, claim token, credentials, transcript or machine paths there.
5. If either surface disagrees about direction or owner, checkpoint affected
   work and reconcile with the lead/current owners. Preserve newer direct user
   direction and original evidence; update the canonical decision explicitly.
   Mirrored status is a view, not another source of executable assignments.

Example safe PR summary: `Packet: catalog-brief-v1; owner: transform-worker;
scope: output/; acceptance: preserve original labels and normalize; private
handoff: agreed channel; ACK: pending.` After the real receipt, update its status
with the receiving owner and tested commit. This is an illustrative manual
record, not CLI synchronization or permission to post.

Neither surface grants execution authority, guarantees private delivery, or
activates a receiving session by itself. A host's separately configured interval
or notification can trigger a bounded check; see the receiving section above.

## Legacy trial

`adapters/legacy-mail.ps1` is the unmodified inspected source, with its separate
[legacy protocol](legacy-protocol.md). It requires Windows PowerShell and Git;
IDs are fixed to `codex`, `claude`, `human`. It writes dynamic worktree paths to
its private mail; never upload those envelopes to public threads. Its identity
labels and interactive-person checks prevent accidents, not impersonation.

Do not mix formats or point the generalized CLI at a legacy mailbox. Legacy
claims have no per-session fencing or generalized transfer API. Use the new
mailbox for independently named same-engine workers and explicit transfer.
