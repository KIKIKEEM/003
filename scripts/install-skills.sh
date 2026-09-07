#!/usr/bin/env bash
#
# Install the paper-writing skills from registry/skills.json.
#
# Skills marked "vendored" in the registry live under this repo's
# .claude/skills/ and are ready to use as-is. Skills marked "external" are
# cloned into vendor/ and symlinked into .claude/skills/ — both of those paths
# are gitignored, so nothing third-party is redistributed from this repo.
#
# With --target, the whole set is installed into another project instead: the
# vendored skills are copied in, the external ones cloned under that project.
#
#   ./scripts/install-skills.sh                  # install external skills here
#   ./scripts/install-skills.sh flonat           # only ids matching a filter
#   ./scripts/install-skills.sh --target ~/proj  # install everything into ~/proj
#   ./scripts/install-skills.sh --list           # show the registry
#   ./scripts/install-skills.sh --sync           # git pull each existing clone
#   ./scripts/install-skills.sh --remove         # drop clones and symlinks
#
# Runs on bash 3.2 (stock macOS) with BSD or GNU sed.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT"

# id|repo|ref|license|"dest:srcpath ..."
EXTERNAL=(
  "academic-research-skills|imbad0202/academic-research-skills|main|CC BY-NC 4.0|deep-research:deep-research academic-paper:academic-paper academic-paper-reviewer:academic-paper-reviewer academic-pipeline:academic-pipeline"
  "flonat-research|flonat/flonat-research|main|MIT|latex-flonat:skills/latex camera-ready:skills/camera-ready bib-parse:skills/bib-parse math-proof:skills/math-proof replication-audit:skills/replication-audit experiment-design:skills/experiment-design"
  "latex-document-skill|ndpvt-web/latex-document-skill|main|unlicensed|latex-document-skill:."
)

# Committed under .claude/skills/ — copied when installing into another project.
VENDORED="paper-writing claude-latex-paper-skill latex"

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

selected() {  # $1=id, rest=filters — no filters means everything
  [ "$#" -le 1 ] && return 0
  local id="$1"; shift
  for want in "$@"; do case "$id" in *"$want"*) return 0 ;; esac; done
  return 1
}

skill_name_of() {  # $1=skill dir — frontmatter `name:` value, empty if absent
  [ -f "$1/SKILL.md" ] || return 0
  awk '/^---$/{n++; next} n==1 && /^name:/{sub(/^name:[ \t]*/,""); gsub(/^["'"'"']|["'"'"']$/,""); print; exit}' "$1/SKILL.md"
}

set_skill_name() {  # $1=skill dir, $2=new name — rewrite frontmatter `name:`
  local f="$1/SKILL.md" tmp="$1/.SKILL.md.tmp"
  awk -v new="$2" '/^---$/{n++} n==1 && !done && /^name:/{print "name: " new; done=1; next} {print}' "$f" >"$tmp"
  mv "$tmp" "$f"
}

install_vendored() {
  local src="$ROOT/.claude/skills" dest="$TARGET/.claude/skills"
  for name in $VENDORED; do
    selected "$name" "$@" || continue
    [ -d "$src/$name" ] || { printf '  skip %s (not present in this repo)\n' "$name"; continue; }
    rm -rf "$dest/$name"
    cp -R "$src/$name" "$dest/$name"
    printf '  copied .claude/skills/%s (MIT)\n' "$name"
  done
}

place_skills() {  # $1=clone dir, rest=dest:srcpath pairs
  local clone="$1"; shift
  local skills="$TARGET/.claude/skills"
  for pair in "$@"; do
    local dest="${pair%%:*}" src="${pair#*:}"
    [ -e "$clone/$src" ] || { printf '  skip %s (upstream layout changed: %s missing)\n' "$dest" "$src"; continue; }
    rm -rf "$skills/$dest"

    # Claude Code keys skills off the frontmatter `name:`, not the directory.
    # Installing under a different name to dodge a collision only works if the
    # copy carries the new name too — so materialise it instead of symlinking.
    local upstream_name; upstream_name="$(skill_name_of "$clone/$src")"
    if [ -n "$upstream_name" ] && [ "$upstream_name" != "$dest" ]; then
      cp -R "$clone/$src" "$skills/$dest"
      set_skill_name "$skills/$dest" "$dest"
      printf '  copied .claude/skills/%s (renamed from "%s")\n' "$dest" "$upstream_name"
    else
      ln -s "$clone/$src" "$skills/$dest"
      printf '  linked .claude/skills/%s\n' "$dest"
    fi
  done
}

main() {
  local mode=install
  while :; do
    case "${1-}" in
      --list) list_registry; return 0 ;;
      --sync) mode=sync; shift ;;
      --remove) mode=remove; shift ;;
      --target) [ -n "${2-}" ] || die "--target needs a directory"
                mkdir -p "$2" || die "cannot create $2"
                TARGET="$(cd "$2" && pwd)"; shift 2 ;;
      -h|--help) awk 'NR>1 && /^#/{sub(/^# ?/,""); print; next} NR>1{exit}' "${BASH_SOURCE[0]}"; return 0 ;;
      *) break ;;
    esac
  done

  command -v git >/dev/null || die "git is required"
  local vendor="$TARGET/vendor" skills="$TARGET/.claude/skills"
  mkdir -p "$vendor" "$skills"

  [ "$TARGET" = "$ROOT" ] || printf 'target: %s\n\n' "$TARGET"

  # The vendored skills already sit in .claude/skills/ when installing in place.
  if [ "$TARGET" != "$ROOT" ] && [ "$mode" = install ]; then
    printf 'vendored skills\n'
    install_vendored "$@"
    printf '\n'
  fi

  for row in "${EXTERNAL[@]}"; do
    IFS='|' read -r id repo ref lic pairs <<<"$row"
    selected "$id" "$@" || continue
    local clone="$vendor/$id"
    local pair_arr; read -r -a pair_arr <<<"$pairs"

    if [ "$mode" = remove ]; then
      printf '%s: removing\n' "$id"
      for pair in "${pair_arr[@]}"; do rm -rf "$skills/${pair%%:*}"; done
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
    place_skills "$clone" "${pair_arr[@]}"
  done

  if [ "$mode" = remove ] && [ "$TARGET" != "$ROOT" ]; then
    for name in $VENDORED; do rm -rf "$skills/$name"; done
    printf 'vendored skills: removed\n'
  fi

  [ "$mode" = remove ] || printf '\nDone. Restart Claude Code so it rescans .claude/skills/.\n'
}

main "$@"
