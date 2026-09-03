#!/usr/bin/env bash
set -uo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
input=$(cat)
IFS=$'\x1f' read -r event file active < <(printf '%s' "$input" | bun -e 'const j = JSON.parse(await Bun.stdin.text()); console.log([j.hook_event_name ?? "", j.tool_input?.file_path ?? "", j.stop_hook_active === true ? "1" : "0"].join("\x1f"))') || exit 0
if [[ $event == PostToolUse ]]; then
  [[ -n $file ]] || exit 0
  out=$("$root/scripts/agent-verify" "$file" 2>&1) && exit 0
  printf '%s\n' "$out" | tail -n 20 >&2
  exit 2
fi
[[ $active == 1 ]] && exit 0
[[ -n $(git -C "$root" status --porcelain) ]] || exit 0
out=$("$root/scripts/agent-verify" 2>&1) && exit 0
printf '%s\n' "$out" | tail -n 30 >&2
exit 2
