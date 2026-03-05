Racetrack Developer Workspace

Repository
https://github.com/ambergkristo/racetrack

This folder defines the developer workflow for the Racetrack realtime system.

All Codex agents must read this file before starting development.

The project follows a milestone-driven workflow with strict ownership boundaries.

Developer roles

Dev A — Ergo
Backend core

Dev B — Kristo Leier
Staff UI

Dev C — Kristo Amberg (Lead)
Public UI + UI/UX system + merge authority

Dev D — Kevin
Socket contract + validation + CI + integration tests

Dev C is the project lead and is responsible for:

approving pull requests

merging to main

maintaining UI/UX consistency

enforcing milestone progression

Mentor is observing only and does not receive tasks.

Repository development rules

Never commit directly to main.

Each developer must work in a feature branch.

Branch format:

feat/m{milestone}-devX-topic

Examples:

feat/m0-devA-env-bootstrap
feat/m0-devB-staff-gate
feat/m0-devC-public-ui
feat/m0-devD-socket-contract

Every milestone must be completed before the next begins.

M0 → M1 → M2 → M3

Dev C merges all pull requests after:

tests pass

milestone scope is satisfied

no contract conflicts exist

If main becomes broken:

STOP THE LINE

All developers pause work until main is fixed.

Milestone structure

The project follows four milestones.

M0 — Foundation

Goal:

repository structure

socket handshake

route skeletons

staff authentication gate

Deliverable:

All routes open successfully and staff routes request keys before socket connection.

M1 — MVP race flow

Goal:

race state machine

timer

session CRUD

lap crossing logic

leaderboard sorting

Deliverable:

End-to-end race session from staging → running → finished → locked.

M2 — Hardening

Goal:

reconnect / resync

illegal transition handling

UX improvements

fullscreen robustness

Deliverable:

System remains stable during reconnects and edge cases.

M3 — Upgrade

Goal:

persistence

manual car assignment

Must be implemented behind feature flags so MVP behaviour remains unchanged.

Feature flags:

FF_PERSISTENCE
FF_MANUAL_CAR_ASSIGNMENT
UI/UX authority

UI/UX design is defined by Dev C.

All screens must follow the racing dashboard design system:

Theme

background #0b0b0f
panel #16161c
safe #00ff7b
warning #ffd400
danger #ff2e2e

Fonts

Orbitron (headings)
Rajdhani (UI text)

Shared components:

AppShell
Panel
TelemetryHeader
FullscreenButton
KeyGateModal

Staff routes must request the access key before Socket.IO connection.

Public routes must include a Fullscreen button.

Socket architecture

Realtime updates must use Socket.IO.

Polling is not allowed for live state updates.

Allowed:

initial bootstrap request

All further updates must be sent through socket events.

Server is the authoritative state source.

Clients are thin views.

Security

Staff interfaces require access keys.

Keys are provided through environment variables.

Example:

FRONT_DESK_KEY
RACE_CONTROL_KEY
LAP_LINE_TRACKER_KEY

Server must refuse to start if keys are missing.

Wrong key responses must be delayed by 500 ms.

Developer workflow

Before starting work:

Read your developer folder inside:

Sources/Developers/

Example:

Dev-A-Ergo
Dev-B-Kristo-Leier
Dev-C-Kristo-Amberg
Dev-D-Kevin

Each folder contains:

CODEX-M{milestone}.md

Example:

CODEX-M0.md

These files contain the exact instructions for Codex agents.

Pull request rules

PR must include:

milestone tag in title

description of implemented scope

confirmation that tests pass

Example PR title:

M0: env/config bootstrap (Dev A)

PR checklist:

tests pass
branch name correct
milestone scope respected
no unrelated refactors
Critical system principles

Server is authoritative

Timer is server-controlled

No polling for state updates

Staff authentication happens before socket connection

Feature flags must not change default behaviour

Summary

This folder contains the Codex prompts used by each developer agent.

Workflow:

read README
open developer folder
execute milestone prompt
create feature branch
implement milestone scope
open pull request
Dev C merges

Development proceeds milestone by milestone until the final deadline of April 15, 2026.
