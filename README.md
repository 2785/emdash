# Emjosh

**Emjosh is a shamelessly forked copy of [Emdash](https://github.com/generalaction/emdash).**

It's my personal build of Emdash with the features I want and the rough edges I care about
filed down. For the time being I'm not planning to contribute any of it back upstream; that
may change once I'm happy with it. It is intended for friends and family, not general
distribution.

The motivation: Meta acquired and shut down [Conductor](https://conductor.build), and I'd
rather not depend on a tool I don't control again. Emdash is open source (Apache-2.0), so
I have a copy I can keep running and shape however I like.

Emjosh is not affiliated with or endorsed by the Emdash team. Please don't report Emjosh
problems to them.

## What's different from Emdash

### Agents managing workspaces

- **Workspace tools for agents.** Every chat agent (and Claude in a terminal) gets an
  `emjosh` MCP server: list projects and workspaces (branch, agent status, PR state),
  describe its own workspace, create workspaces (a new branch and worktree whose first prompt
  starts right away), and archive others. Ask things like "archive the workspaces whose PRs
  merged" or "make workspaces in these four repos for the same change".
- **Initiatives.** Optional groups of workspaces across repositories working towards one goal.
  Group the sidebar by initiative, add tasks from their context menu (*Initiative…*), or let
  agents create and fill them.
- **Workspaces talking to each other.** Each initiative has a message feed: agents post to
  everyone or one workspace and read or wait for replies; Emjosh adds events (a workspace
  finished, needs approval, failed). Optionally, messages are delivered straight into each
  workspace's chat, labelled as coming from a peer.
- **External agents.** Settings → General → *Connect an external agent* copies a
  `claude mcp add` command so a `claude` outside Emjosh can use the same tools while Emjosh
  is open.

### Chat

- **Interrupt mode.** Settings → General → *Messages sent while agent is working*: *Queue*
  (Emdash's behavior) or *Interrupt*, which hands your message (merged with anything queued)
  to the running agent mid-turn, so it decides what to stop or let finish. Agents that can't
  take messages mid-turn stop and run it next.
- **Inline attachment references.** Pasted or dropped images get an `[Image 1]` pill where
  your cursor is, and the agent sees which image is which; long pasted text collapses into a
  `[Snippet 1]` pill that still sends the full text in place.

### Sidebar and workspaces

- **Group by project, initiative, or nothing.** The sort menu's *Group by* lists every task in
  one cross-repo list (labelled with its project), optionally split by initiative.
- **"Last used" means real activity.** Tasks move up when a prompt is sent or a turn finishes
  or needs you, not when you click into them.
- **Workspace names follow the work.** A workspace with an automatic name takes its first
  conversation's title once the agent sets one; names you chose are never touched.
- **More reliable agent status.** Fewer conversations stuck spinning or wrongly flagged as
  waiting for you (after reopening a chat, a restart, or an interrupted turn).

### App

- **Window frame color.** Settings → Interface → *Window frame color* tints the title bar and
  sidebar (darker in dark mode, brighter in light mode) so the window is easy to spot.
- **Remembered link choice.** "Open link?" can remember in-app vs. default browser
  (Settings → Interface → *Open links in*).
- **Its own app.** `Emjosh.app` installs next to Emdash, with its own data
  (`~/Library/Application Support/emjosh`), keychain entry, and icon, and never auto-updates
  from Emdash releases.
- **Reload button.** Rebuild, then click *Reload* in the sidebar (or Emjosh → Reload Emjosh)
  to restart on the new build.
- **No Emdash branding or services.** No Emdash account, feedback, update, or docs surfaces,
  and local builds carry no telemetry key, so nothing is sent.

## Install (macOS, Apple Silicon)

Download `Emjosh-mac-arm64.zip` from the
[latest release](https://github.com/2785/emjosh/releases/latest), unzip it, and move
`Emjosh.app` to Applications.

Releases are signed but not notarized by Apple, so the first launch is blocked with "Apple could
not verify…". Right-click `Emjosh.app` → *Open* → *Open* once (or allow it under System Settings →
Privacy & Security). After that it opens normally.

Coming from Emdash? Copy your projects, tasks, and conversations over once, with Emjosh
closed (needs a clone of this repository and `pnpm`):

```bash
pnpm --dir apps/emdash-desktop run seed:emjosh
```

Saved sign-ins come along too: on first launch Emjosh asks once to read Emdash's keychain
key and re-encrypts them under its own.

## Updating

Emjosh checks for new releases every hour and downloads them in the background; the sidebar
button then reads *Reload · new build*. Click it to restart on the new version. Updates are
only installed if they are signed with the same certificate as the running app.

## Building it yourself

You need `pnpm` (any version; the repo pins its own pnpm and Node) and the Xcode command line
tools (`xcode-select --install`).

```bash
git clone https://github.com/2785/emjosh.git
cd emjosh
pnpm install
pnpm --dir apps/emdash-desktop run install:personal
```

That builds `/Applications/Emjosh.app` and opens it, or, if Emjosh is running, stages the build
for its Reload button.

Signing: if your keychain has an **Apple Development** certificate (free with any Apple ID:
Xcode → Settings → Accounts → Manage Certificates → + → Apple Development), builds are signed
with it and macOS keeps your keychain approvals across rebuilds. Otherwise the first build
creates a self-signed "Emjosh Local Signing" certificate, and macOS asks for keychain access
once after each rebuild. Self-built copies still receive release updates only if they're signed
with the release certificate.

## Releasing

From a clean checkout of merged `main`, signed in to `gh` as the repository owner:

```bash
pnpm --dir apps/emdash-desktop run release          # next patch version
pnpm --dir apps/emdash-desktop run release minor    # or major, or an explicit X.Y.Z
```

It builds and signs the app, then publishes the zip and an update manifest as a GitHub release.
Only the repository owner can publish releases, and release tags can't be moved or deleted.

## Development

The codebase is Emdash's: an Electron + React app in a pnpm/Nx monorepo. The Electron app
lives in `apps/emdash-desktop/`, shared packages in `packages/`. Start with
[AGENTS.md](AGENTS.md) for architecture and conventions; the full gate is `pnpm run check`.

## Credit and license

All the hard work is Emdash's, by [General Action](https://github.com/generalaction) and its
contributors. Go use [Emdash](https://emdash.sh) if you want the real, supported thing.

Emjosh is distributed under the same [Apache-2.0 license](LICENSE.md). Files have been modified
from the Emdash originals; see this repository's commit history for the changes.
