## Milestone
- [ ] M0
- [ ] M1
- [ ] M2
- [ ] M3

## Developer
- [ ] Dev A
- [ ] Dev B
- [ ] Dev C
- [ ] Dev D

## Branch Name
<!-- Must match: feat/m{milestone}-devX-topic -->
`<branch-name>`

## Scope
<!-- Describe exactly what is implemented in this PR -->

## Out of Scope
<!-- Explicitly list what this PR does NOT include -->

## Validation
- [ ] `npm ci`
- [ ] `npm run build`
- [ ] `npm start` smoke check
- [ ] Manual verification done (if applicable)

## Contract Impact
- [ ] No Socket.IO contract changes
- [ ] Socket.IO contract changed (document below)

<!-- If changed, link/update docs/contracts/socket-contract-m0.md or milestone-specific contract docs -->

## Checklist
- [ ] No polling logic introduced for live updates
- [ ] Staff key gate before socket connect preserved (if staff flow touched)
- [ ] CI is green
- [ ] No unrelated refactors
