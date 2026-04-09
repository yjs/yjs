# Incident Response Plan

How Yjs maintainers handle security incidents. This plan is designed for small teams.

---

## 1. Receive a Private Disclosure

All security issues should be reported privately via the method described in [`SECURITY.md`](../SECURITY.md) (GitHub Security Advisory). Lower-severity issues can be filed as regular issues.

**Target:** Acknowledge receipt within 3 business days.

---

## 2. Triage

Assess severity:

| Severity | Example | Target |
|----------|---------|--------|
| **Critical** | Arbitrary code execution, compromised release | Acknowledge < 24h, fix < 7d |
| **High** | Data leakage, denial of service on shared docs | Acknowledge < 3d, fix < 14d |
| **Medium** | Edge-case corruption under unusual conditions | Fix in next release |
| **Low** | Informational, no direct user risk | Fix as scheduled |

These are good-faith targets for a volunteer-maintained project, not SLAs.

---

## 3. Contain & Fix

1. **Open a private GitHub Security Advisory** for the issue if one doesn't already exist.
2. **Develop the fix** in the advisory's private fork to avoid leaking details.
3. **Assign a CVE** through GitHub's advisory flow before publishing.
4. **Yank affected releases from npm** (`npm deprecate` with a message pointing to the advisory) if the severity is Critical or High.
5. **Publish the patched release** to npm.
6. **Update the version support matrix** in `SECURITY.md`.

---

## 4. Disclose

After the fix is published:

1. **Publish the GitHub Security Advisory** with:
   - What happened
   - Which versions are affected
   - How users can update or mitigate
   - The assigned CVE
2. **Notify sponsors** via the appropriate channel (email, GitHub Sponsors update, or OpenCollective post).
3. **Post to GitHub Discussions** for broader community awareness, linking to the advisory.

Responsible disclosure principles:
- Never publish details before a fix is available.
- Never name reporters without their consent.
- Coordinate embargo periods with downstream consumers (e.g., major framework integrations) when needed.

---

## 5. Post-Incident

Within one week of resolution:

- Note what happened, what worked, and what to improve (can be a short section in the advisory itself or a comment on the discussion post).
- Update this plan if the process broke down anywhere.

---

## 6. Checklist (quick reference)

```
[ ] Private report received & acknowledged
[ ] Severity assessed
[ ] Private advisory + fork created on GitHub
[ ] Fix developed & tested
[ ] CVE assigned
[ ] Affected npm versions deprecated (if Critical/High)
[ ] Patched release published
[ ] SECURITY.md version matrix updated
[ ] Advisory published
[ ] Sponsors notified
[ ] Community notified (Discussions)
[ ] Post-incident notes written
```

---

## Plan Maintenance

Review this plan once a year or after any incident. Changes are tracked in git history.
