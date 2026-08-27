#!/usr/bin/env bash
#
# Install the external skills listed in registry/skills.json.
#
# Skills marked "vendored" in the registry are already committed under
# .claude/skills/ and need nothing from this script. Skills marked "external"
# are cloned into vendor/ and symlinked into .claude/skills/ — both of those
# paths are gitignored, so nothing third-party is redistributed from here.
#
#   ./scripts/install-skills.sh            # install every external skill
#   ./scripts/install-skills.sh ars        # install only matching ids
#   ./scripts/install-skills.sh --list     # show the registry
#   ./scripts/install-skills.sh --sync     # git pull each existing clone
#   ./scripts/install-skills.sh --remove   # drop clones and symlinks
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor"
SKILLS="$ROOT/.claude/skills"

# id|repo|ref|license|"dest:srcpath ..."
EXTERNAL=(
  "academic-research-skills|imbad0202/academic-research-skills|main|CC BY-NC 4.0|deep-research:deep-research academic-paper:academic-paper academic-paper-reviewer:academic-paper-reviewer academic-pipeline:academic-pipeline"
  "flonat-research|flonat/flonat-research|main|MIT|latex-flonat:skills/latex camera-ready:skills/camera-ready bib-parse:skills/bib-parse math-proof:skills/math-proof replication-audit:skills/replication-audit experiment-design:skills/experiment-design"
  "latex-document-skill|ndpvt-web/latex-document-skill|main|unlicensed|latex-document-skill:."
)

die() { printf 'error: %s\n' "$1" >&2; exit 1; }

list_registry() {
  printf '%-26s %-14s %s\n' ID LICENSE REPO
  printf '%-26s %-14s %s\n' 'paper-writing' 'MIT' 'SNL-UCSB/paper-writing-skill (vendored)'
  printf '%-26s %-14s %s\n' 'claude-latex-paper-skill' 'MIT' 'witold-andelie/claude-latex-paper-skill (vendored)'
  printf '%-26s %-14s %s\n' 'latex' 'MIT' 'hameefy/claude-latex-skill (vendored)'
  for row in "${EXTERNAL[@]}"; do
    IFS='|' read -r id repo _ lic _ <<<"$row"
    printf '%-26s %-14s %s\n' "$id" "$lic" "$repo (external)"
  done
}

selected() {  # $1=id — no filters means everything
  [ "$#" -le 1 ] && return 0
  local id="$1"; shift
  for want in "$@"; do [[ "$id" == *"$want"* ]] && return 0; done
  return 1
}

skill_name_of() {  # $1=skill dir — frontmatter `name:` value, empty if absent
  [ -f "$1/SKILL.md" ] || return 0
  sed -n '/^---$/,/^---$/{s/^name: *//p}' "$1/SKILL.md" | head -1 | tr -d '"'"'"' '
}

link_skills() {  # $1=clone dir, $2...=dest:srcpath pairs
  local clone="$1"; shift
  for pair in "$@"; do
    local dest="${pair%%:*}" src="${pair#*:}"
    [ -e "$clone/$src" ] || { printf '  skip %s (upstream layout changed: %s missing)\n' "$dest" "$src"; continue; }
    rm -rf "$SKILLS/$dest"

    # Claude Code keys skills off the frontmatter `name:`, not the directory.
    # When we install under a different name to dodge a collision, the copy has
    # to carry the new name too — so materialise it instead of symlinking.
    local upstream_name; upstream_name="$(skill_name_of "$clone/$src")"
    if [ -n "$upstream_name" ] && [ "$upstream_name" != "$dest" ]; then
      cp -r "$clone/$src" "$SKILLS/$dest"
      sed -i "0,/^name: .*/s//name: $dest/" "$SKILLS/$dest/SKILL.md"
      printf '  copied .claude/skills/%s (renamed from "%s")\n' "$dest" "$upstream_name"
    else
      ln -s "$clone/$src" "$SKILLS/$dest"
      printf '  linked .claude/skills/%s\n' "$dest"
    fi
  done
}

main() {
  local mode=install
  case "${1-}" in
    --list) list_registry; return 0 ;;
    --sync) mode=sync; shift ;;
    --remove) mode=remove; shift ;;
    -h|--help) sed -n '2,${/^#/!q;p;}' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; return 0 ;;
  esac

  command -v git >/dev/null || die "git is required"
  mkdir -p "$VENDOR" "$SKILLS"

  for row in "${EXTERNAL[@]}"; do
    IFS='|' read -r id repo ref lic pairs <<<"$row"
    selected "$id" "$@" || continue
    local clone="$VENDOR/$id"
    read -r -a pair_arr <<<"$pairs"

    if [ "$mode" = remove ]; then
      printf '%s: removing\n' "$id"
      for pair in "${pair_arr[@]}"; do rm -rf "$SKILLS/${pair%%:*}"; done
      rm -rf "$clone"
      continue
    fi

    printf '%s (%s, %s)\n' "$id" "$repo" "$lic"
    [ "$lic" = "unlicensed" ] &&
      printf '  note: no upstream LICENSE file — review the terms before relying on it\n'
    [ "$lic" = "CC BY-NC 4.0" ] &&
      printf '  note: non-commercial use only\n'

    if [ -d "$clone/.git" ]; then
      [ "$mode" = sync ] && { printf '  updating\n'; git -C "$clone" pull --ff-only -q; }
    else
      [ "$mode" = sync ] && { printf '  not installed, skipping\n'; continue; }
      printf '  cloning\n'
      git clone --depth 1 -b "$ref" -q "https://github.com/$repo.git" "$clone"
    fi
    link_skills "$clone" "${pair_arr[@]}"
  done

  [ "$mode" = remove ] || printf '\nDone. Restart Claude Code so it rescans .claude/skills/.\n'
}

main "$@"
