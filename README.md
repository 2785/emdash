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

- **Interrupt mode for chat.** Settings → General → *Messages sent while agent is working*:
  *Queue* (Emdash's behavior) or *Interrupt*, which cancels the running turn and sends your
  message, merged with anything already queued, as one prompt.
- **More reliable agent status.** Fewer conversations stuck spinning or wrongly flagged as
  waiting for you (e.g. after reopening a chat, a restart, or an interrupted turn).
- **Its own app.** `Emjosh.app` installs next to Emdash, with its own data
  (`~/Library/Application Support/emjosh`) and keychain entry, and never auto-updates from
  Emdash releases.
- **Reload button.** Rebuild, then click *Reload* in the sidebar (or Emjosh → Reload Emjosh)
  to restart on the new build.
- **No Emdash branding or services.** No Emdash account, feedback, update, or docs surfaces,
  and local builds carry no telemetry key, so nothing is sent.

## Install (macOS, Apple Silicon)

There are no prebuilt releases; you build it yourself. You need `pnpm` (any version; the repo
pins its own pnpm and Node) and the Xcode command line tools (`xcode-select --install`).

```bash
git clone https://github.com/2785/emjosh.git
cd emjosh
pnpm install
pnpm --dir apps/emdash-desktop run install:personal
```

That builds `/Applications/Emjosh.app` and opens it. The first build creates a local
self-signed code signing certificate ("Emjosh Local Signing") in your login keychain, so
macOS remembers your keychain and privacy approvals across rebuilds.

Coming from Emdash? Copy your projects, tasks, and conversations over once, with Emjosh
closed:

```bash
pnpm --dir apps/emdash-desktop run seed:emjosh
```

Saved sign-ins come along too: on first launch Emjosh asks once to read Emdash's keychain
key and re-encrypts them under its own.

## Updating

```bash
git pull
pnpm --dir apps/emdash-desktop run install:personal
```

If Emjosh is running, the new build is staged and the sidebar button turns into
*Reload · new build*. Click it to restart on the new build.

## Development

The codebase is Emdash's: an Electron + React app in a pnpm/Nx monorepo. The Electron app
lives in `apps/emdash-desktop/`, shared packages in `packages/`. Start with
[AGENTS.md](AGENTS.md) for architecture and conventions; the full gate is `pnpm run check`.

## Credit and license

All the hard work is Emdash's, by [General Action](https://github.com/generalaction) and its
contributors. Go use [Emdash](https://emdash.sh) if you want the real, supported thing.

Emjosh is distributed under the same [Apache-2.0 license](LICENSE.md). Files have been modified
from the Emdash originals; see this repository's commit history for the changes.
