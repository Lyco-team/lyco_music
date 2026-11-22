# Desktop UI parity comparison test report

## Scope

Goal: compare every desktop page and the full changed UI surface of the Netease-style UI feat, and guard it with repeatable tests.

## Automated coverage

- Contract suite: `tests/desktop-ui-parity.test.ts`
- Command: `pnpm test:ui-parity`
- Contract tests cover:
  - all 13 Vue Router targets and their view files
  - page-level structure for every view
  - changed files: shell tokens, Sidebar, TopBar, PlayBar, Home, Player, three new card components, global CSS
  - explicit DESIGN.md measurements: sidebar/topbar/bottombar spacing, radii, card sizes, vinyl geometry
  - interaction hooks: carousel scroll buttons, play-count badges, player spin/lyric state
  - brand redline: no 网易云音乐 / 云村 / Netease brand assets in the changed UI surface

## Runtime comparison

Rendered with ego-browser against the built desktop preview at 1600×1000. Screenshots are saved in `/tmp/ui-parity-shots/`.

| Route | Page | Screenshot | Result |
|---|---|---|---|
| `#/` | Home | `home.png` | PASS - sidebar/topbar/channel cards/playlists/activities visible |
| `#/search` | Search | `search.png` | PASS |
| `#/discover` | Discover | `discover.png` | PASS |
| `#/player` | Player | `player.png` | PASS - vinyl/lyric/tabs visible |
| `#/account` | Account | `account.png` | PASS |
| `#/membership` | Membership | `membership.png` | PASS |
| `#/sync` | Sync | `sync.png` | PASS |
| `#/my` | My Music | `my.png` | PASS |
| `#/downloads` | Downloads | `downloads.png` | PASS |
| `#/import` | Import | `import.png` | PASS |
| `#/friends` | Friends | `friends.png` | PASS |
| `#/settings` | Settings | `settings.png` | PASS |
| `#/lyric-window` | Desktop lyric | `lyric-window.png` | PASS |

## Verification results

- `pnpm --filter @lxmn/app-desktop typecheck`: PASS
- `pnpm --filter @lxmn/app-desktop build`: PASS
- `pnpm test`: PASS, 53 passed files + 13 skipped, 626 passed tests + 22 skipped
- `pnpm test:ui-parity`: PASS, 8/8 tests

## Notes

- The build emits a pre-existing warning about `sync.ts` being both dynamically and statically imported; it does not affect build success.
- `pnpm lint` cannot run in this environment because `eslint` is not installed.
- The desktop lyric route intentionally renders a transparent standalone-window page, so it has no `h1/h2/section` landmark; the contract test accepts its root `div`.
