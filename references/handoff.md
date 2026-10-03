# Packet and receipt templates

Use repository-relative paths or configured project/artifact labels. Keep
private session, machine and absolute-path details out of shared/public payloads.
Do not copy transcripts or instructions from the host into messages.

```text
Packet: <stable packet key>
Coordination: <canonical agreed PR/thread or local ledger; sanitized summary>
Private correlation: <authorized private mailbox identity; keep off GitHub>
Owner/role: <participant / executor>
Project/target: <project label / branch>
Base/head: <exact base commit> / <tested head commit>
Included: <exact commits and relative paths>
Excluded: <known adjacent work>
Dependencies: <ordered required heads/interfaces, current producer owners>
Reservation: <exact files or declared seams and receiving owner>
Inputs: <source/export identities, hashes, notices, regeneration command>
Evidence: <commands, exit/results, exact tested revision, retained failures>
Readiness: <implemented / reviewed / integration-ready for named scope>
Limits: <experimental behavior, missing checks, blocked dependencies>
Recovery: <checkpoint/rollback and named forward fixer>
Next: <receiving owner and action, resources retained/released>
Direction revision: <latest user change, affected acceptance, reconciled owners>
```

ACK body:

```text
Receipt: <packet key>; received by <participant>
Target: <project label / branch / baseline>
Reservation: <accepted exact paths or seam; conflict if unresolved>
Next action: <review/apply/test and receiving owner>
```

ACK means receipt. Applied means a concrete commit on the receiving target
contains the packet and the relevant verification passed. Record that commit
in the result or integration ledger. Delivery timestamps and test counts are
not quality acceptance.
When bridging PRs and local mail, correlate one packet to its existing comment
and private handoff; reuse existing actions rather than dispatching a second
queue. A PR ACK/status omits private paths/tokens/payloads. The shared decision
ledger and private claim state have distinct purposes; conflicts need the lead
and current owners, not an automatic overwrite. See [bridge steps](adapters.md#using-local-mail-and-pr-comments-together).

For a direct user interjection record: source session label, packet, requested
change, retained/new scope, current owner, affected acceptance/evidence and
receiving leader/coordinator. This is a concise decision record, not a chat
transcript. Record prepared, delivered and acknowledged separately; a local note
does not prove the other session has seen it. Keep the original goal owned and
name the next action for any paused/conflicting portion.

For ownership changes, offer transfer naming target and reason; the receiver
must explicitly accept. Preserve packet identity, source custody, failures and
remaining work. Until acceptance, no new executor gains the claim. The accepted
transfer records a receipt and new fencing token; old credentials cannot finish.
