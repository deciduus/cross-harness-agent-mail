# Transport and session capability boundary

| Route | Proven capability | Session control | Status |
| --- | --- | --- | --- |
| Generalized local file mailbox | Send/check/claim, fenced completion, receipts, transfer/recovery | None | Synthetic process tests on Windows |
| Codex manual consumer | Configured participant + CLI | None | Routing tested; no live Codex session trial |
| Claude manual consumer | Configured participant + CLI | None | Routing tested; no live Claude session trial |
| Other manual consumer | Arbitrary configured participant + CLI | None | Same routing contract; host-specific discovery untested |
| Original PowerShell trial | Original Codex/Claude file protocol | None | Windows synthetic lifecycle/claim tests |
| GitHub PR comments | Human/authorized host-tool delivery | None | Optional documented route; no automated posting adapter |

Use capability detection before selecting a route. Executable capability output
must distinguish `delivery`, `wake`, and `stopSession`. Installed executables or a
reachable mailbox do not prove a session can receive a wake-up. Unsupported
wake/stop requests terminate with an unsupported result; no guessed queue,
message, cron or process command is attempted.

To add another agent, configure a unique participant ID, role and `engine: other`
and have an explicitly activated session consume the CLI. To add real session
control later, implement an explicit adapter whose supported operation returns
an evidence-backed receipt; test it in an isolated authorized host. Keep routing,
acknowledgement and session control separate. Do not advertise support based only
on executable detection. No such control adapter ships here.

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
  checking the same inbox or lease.
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

## Legacy trial

`adapters/legacy-mail.ps1` is the unmodified inspected source, with its separate
[legacy protocol](legacy-protocol.md). It requires Windows PowerShell and Git;
IDs are fixed to `codex`, `claude`, `human`. It writes dynamic worktree paths to
its private mail; never upload those envelopes to public threads. Its identity
labels and interactive-person checks prevent accidents, not impersonation.

Do not mix formats or point the generalized CLI at a legacy mailbox. Legacy
claims have no per-session fencing or generalized transfer API. Use the new
mailbox for independently named same-engine workers and explicit transfer.
