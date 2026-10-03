# Packet and receipt templates

Use repository-relative paths or configured project/artifact labels. Keep
private session, machine and absolute-path details out of shared/public payloads.
Do not copy transcripts or instructions from the host into messages.

```text
Packet: <stable packet key>
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

For ownership changes, offer transfer naming target and reason; the receiver
must explicitly accept. Preserve packet identity, source custody, failures and
remaining work. Until acceptance, no new executor gains the claim. The accepted
transfer records a receipt and new fencing token; old credentials cannot finish.
