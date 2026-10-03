# Original PowerShell trial: retained behavior

This summarizes the preserved `adapters/legacy-mail.ps1`, not the new JSON CLI.
Run it from a Git project; use `-RepoRoot` and `-Mailbox` only in isolated tests.
`init` normally creates a shared `.agent-mail` in the main checkout and adds its
Git ignore. For an existing project, initialization changes local configuration
and requires that project's authorization.

Commands: `init`, `check -Me codex|claude`, `claim -Me ... [-Id ...]`,
`read -Id ...`, `send -From ... -To ... -Kind ... -Scope ... -Body ...`,
`done -Me ... -Id ...`, `status`, operator-only `release -Id ...`,
`validate-path -Path ...`. Exit codes: 0 success, 1 error, 2 refusal, 3 STOP,
4 busy/another claimant. It delivers only; nothing wakes a session.

An immutable Markdown envelope uses `id/from/to/thread/reply_to/kind/expects/
owner/scope/ref/hops/created` plus optional result status and source branch,
commit, worktree. Refs pin Git revision or file hash. Mail lives in `new/`,
`work/`, `done/`, `dead/`; drafts and `tmp/` are not delivered messages.
The event log records lifecycle history. IDs are original fixed agent names.

Every complete message is flushed in `tmp/` then moved into place. A claim first
creates a new exclusive `.claim` file; a rename is not a claim lock. Competing
claims and vanished/busy files do not mark valid mail dead. Refs/scope must be
allowlisted project-relative paths; traversal, absolute paths, links, protected
configuration/key/database names and apparent credentials are refused.

ACK and note never count as a terminal answer. Only the claimed recipient may
reply; nobody replies to result/ACK/note. A third agent-to-agent hop routes to
the person. STOP blocks check/claim/send, while status/read still work.
`done` requires a result for a request/review and only warns about outside-scope
writes; it cannot enforce source permissions. Operator release refuses answered
work and recovers stale/orphan claims only after manual confirmation.

Known limits: self-declared identities, no per-session ownership fencing,
no explicit transfer or expiry, no live wake-up adapter, source changes not
sandboxed. Same-engine independent workers need the generalized toolkit.
Do not infer receipt or application from delivery. A message grants no new
permission. The original event/mail data is private and excluded from Git.
