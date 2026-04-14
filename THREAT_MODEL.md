# Threat Model - Yjs

This document outlines the threat model for the Yjs project, a CRDT framework for shared editing. It identifies assets, threat actors, attack surfaces, and mitigations.

## 1. Assets

What we are protecting:

| Asset | Description |
|-------|-------------|
| Document data | Shared documents edited by end users via Yjs-powered applications |
| Library integrity | The correctness and safety of the Yjs source code and published npm packages |
| CI/CD pipeline | GitHub Actions workflows, publishing credentials, and automation |
| Maintainer accounts | GitHub and npm accounts of project maintainers |
| User trust | Reputation and reliability of the project as a dependency |

## 2. Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| Malicious contributor | Inject backdoor or vulnerable code via pull requests | Low-Medium: constrained by code review |
| Supply chain attacker | Compromise a dependency to reach Yjs consumers downstream | Medium: targets transitive dependencies |
| Malicious peer (network) | Exploit the CRDT sync protocol to corrupt documents or crash peers | Medium: can craft arbitrary binary messages |
| Compromised maintainer account | Publish a malicious package version to npm | High: full publish access |
| Automated bots | Spam, typosquatting, or social engineering via issues/PRs | Low |

## 3. Attack Surfaces

### 3.1 Document Corruption by Write-Peers

Any peer with write access has the theoretical ability to corrupt a Yjs document. The CRDT protocol is designed for collaboration between trusted peers — it guarantees conflict-free merging, but it does not protect against a malicious peer intentionally writing destructive operations. Once a malicious update is applied to a document, it becomes part of the document's permanent history.

**It is therefore critical that untrusted peers are never allowed to write updates to the original Yjs document.**

**Server-side filtering of updates is a common antipattern.** Some applications attempt to validate or filter incoming updates on the server before applying them to the shared document. This approach is fundamentally flawed with untrusted peers — Yjs updates are binary-encoded CRDT operations, and selectively filtering them can easily be exploited and is not a reliable security boundary.

**Suggestion-only (untrusted) users should work on a separate Yjs document fork**, not on the original document. Their changes can be reviewed and selectively merged by a trusted peer. Only trusted, authenticated peers should be allowed to write to the authoritative document.

Additionally, a malicious peer could send crafted binary messages to:

- **Cause denial of service** via extremely large updates, deeply nested structures, or messages that trigger excessive computation.
- **Trigger buffer overflows or out-of-bounds reads** in the binary decoder.

**Mitigations:**
- Never allow untrusted peers to write to the original document.
- Use separate document forks for suggestion-only users.
- Do not rely on server-side update filtering as a security measure.
- Authenticate and authorize peers before granting write access.
- Validate incoming binary messages and reject malformed data.
- Implement size limits on incoming updates where possible.
- Fuzz test the decoder and update application paths.

### 3.2 Supply Chain (Dependencies & npm Publishing)

Yjs is a widely-used library. Compromising it would impact many downstream projects.

**Yjs only depends on packages that are maintained by the Yjs maintainers themselves** (such as `lib0` and `@y/protocols`). This significantly reduces supply chain risk, as there are no third-party runtime dependencies that could be independently compromised.

- **Compromised npm publish token** leading to a malicious release.
- **Typosquatting** of the package name.

However, the project does use third-party **dev dependencies** (linters, test tools, build tools, etc.). A compromised dev dependency could execute malicious code on a maintainer's machine during development, potentially leading to credential theft or tampered releases. It is important to only install trusted dev dependencies and to review them carefully.

**Mitigations:**
- All runtime dependencies are maintained by the Yjs team, eliminating third-party supply chain risk.
- Only install trusted, well-maintained dev dependencies and review new additions carefully.
- Enable MFA on all maintainer npm and GitHub accounts.
- Use `npm provenance` or signed releases where supported.
- Pin dependency versions and review lockfile changes in PRs.
- Monitor for typosquat packages.

### 3.3 Pull Requests & Code Contributions

- **Malicious code** submitted via pull requests (obfuscated backdoors, subtle logic changes).
- **CI exploitation** through crafted PR workflows that exfiltrate secrets.

**Mitigations:**
- Require at least one maintainer review before merging.
- Do not run CI with secrets on PRs from forks.
- Use branch protection rules on `main`.
- Review changes carefully, especially to binary encoding/decoding, crypto, and publishing scripts.

### 3.4 GitHub Actions & CI/CD

- **Secret exfiltration** from workflow runs.
- **Workflow injection** via untrusted input in PR titles, branch names, or commit messages.

**Mitigations:**
- Follow the principle of least privilege for workflow permissions.
- Avoid using `pull_request_target` with checkout of PR code.
- Pin action versions to specific commit SHAs.
- Limit secret access to required workflows only.

### 3.5 Maintainer Account Compromise

- **Account takeover** of a GitHub or npm maintainer account.
- Used to merge malicious PRs, publish backdoored packages, or modify CI.

**Mitigations:**
- Require MFA for all maintainers (GitHub and npm).
- Limit the number of accounts with publish access.
- Periodically review organization members and their permissions.

## 4. Risk Assessment

| Threat | Likelihood | Impact | Priority |
|--------|-----------|--------|----------|
| Malicious CRDT update from peer | Medium | High (data corruption) | High |
| Compromised npm publish | Low | Critical (supply chain) | High |
| Malicious pull request merged | Low | High | Medium |
| Dependency compromise | Low | High | Medium |
| CI secret exfiltration | Low | Medium | Medium |
| Maintainer account takeover | Low | Critical | High |

## 5. Out of Scope

The following are the responsibility of the application developer using Yjs, not the Yjs library itself:

- **Authentication and authorization** of peers connecting to a collaboration session.
- **Transport-layer security** (TLS/WSS) for data in transit.
- **Server-side access control** for who can read or write documents.
- **Application-level input validation** (e.g., sanitizing rich text content for XSS).

## 6. Review Schedule

This threat model should be reviewed:

- At least once per year.
- When a new major version is released.
- When a security incident occurs.
- When significant new features or dependencies are added.
