#!/usr/bin/env bash
set -euo pipefail

BOLD=$(tput bold 2>/dev/null || printf '')
GREEN=$(tput setaf 2 2>/dev/null || printf '')
YELLOW=$(tput setaf 3 2>/dev/null || printf '')
RED=$(tput setaf 1 2>/dev/null || printf '')
RESET=$(tput sgr0 2>/dev/null || printf '')

log() { printf '%s▸ %s%s\n' "${BOLD}" "$1" "${RESET}"; }
ok() { printf '%s✔ %s%s\n' "${GREEN}" "$1" "${RESET}"; }
warn() { printf '%s⚠ %s%s\n' "${YELLOW}" "$1" "${RESET}"; }
die() { printf '%s✖ %s%s\n' "${RED}" "$1" "${RESET}" >&2; exit 1; }

usage() {
  cat <<'EOF'
Uso: ./deploy.sh <origen> to <destino> ["mensaje de commit"]

Flujos permitidos (Git Flow):
  feat/*|fix/*|docs/*|chore/*  to dev     integrar una feature, fix, docs o chore
  dev                          to main    release (publica a npm vía changesets)
  hotfix/*                     to main    hotfix urgente

Ejemplos:
  ./deploy.sh feat/live-source to dev "feat(cli): leer requests de la sesión activa"
  ./deploy.sh dev to main "release: parser tolerante y cola reanudable"

Variables opcionales:
  SKIP_TESTS=1     omite los tests locales (el pipeline igual los corre)
  AUTO_APPROVE=1   no pide confirmación antes del merge
EOF
  exit 1
}

[[ $# -ge 3 && ${2:-} == "to" ]] || usage
SOURCE=$1
TARGET=$3
MESSAGE=${4:-}
PR_NUMBER=""

validate_flow() {
  case "$TARGET" in
    dev)
      [[ $SOURCE == feat/* || $SOURCE == fix/* || $SOURCE == docs/* || $SOURCE == chore/* ]] ||
        die "Git Flow: hacia dev solo se integra feat/*, fix/*, docs/* o chore/* (recibí: $SOURCE)"
      ;;
    main)
      [[ $SOURCE == dev || $SOURCE == hotfix/* ]] ||
        die "Git Flow: hacia main solo se integra dev (release) o hotfix/* (recibí: $SOURCE)"
      ;;
    *)
      die "Git Flow: destino no permitido: $TARGET (solo dev o main)"
      ;;
  esac
}

check_deps() {
  command -v git >/dev/null || die "git no está instalado"
  command -v gh >/dev/null || die "Falta gh (GitHub CLI): https://cli.github.com"
  command -v pnpm >/dev/null || die "pnpm no está instalado: npm i -g pnpm"
  gh auth status >/dev/null 2>&1 || die "gh sin autenticar: corre 'gh auth login'"
}

prepare_branch() {
  git switch "$SOURCE" >/dev/null 2>&1 || die "La rama $SOURCE no existe localmente"
  ok "En rama $SOURCE"
}

run_local_tests() {
  if [[ ${SKIP_TESTS:-0} == 1 ]]; then
    warn "Tests locales omitidos (SKIP_TESTS=1)"
    return
  fi
  log "Tests locales: lint"
  pnpm lint
  log "Tests locales: formato"
  pnpm format:check
  log "Tests locales: typecheck"
  pnpm typecheck
  log "Tests locales: suite Vitest"
  pnpm test
  log "Tests locales: build"
  pnpm build
  log "Tests locales: fronteras de arquitectura"
  pnpm check:boundaries
  log "Tests locales: documentos rastreados"
  pnpm check:docs
  ok "Tests locales en verde"
}

commit_changes() {
  if [[ -z $(git status --porcelain) ]]; then
    log "Working tree limpio: nada que commitear"
    return
  fi
  [[ -n $MESSAGE ]] || die "Hay cambios sin commitear: pasa un mensaje de commit como cuarto argumento"
  git add -A
  git commit -m "$MESSAGE"
  ok "Commit creado: $MESSAGE"
}

push_branch() {
  log "Push de $SOURCE a origin"
  git push -u origin "$SOURCE"
  ok "Rama en remoto"
}

pr_title() {
  if [[ -n $MESSAGE ]]; then
    printf '%s' "$MESSAGE"
  elif [[ $TARGET == main ]]; then
    printf 'release: %s → main (%s)' "$SOURCE" "$(date +%Y-%m-%d)"
  else
    git log -1 --pretty=%s
  fi
}

ensure_pr() {
  PR_NUMBER=$(gh pr list --head "$SOURCE" --base "$TARGET" --state open \
    --json number --jq '.[0].number' 2>/dev/null || true)
  if [[ -n $PR_NUMBER ]]; then
    log "Reutilizando PR abierto #$PR_NUMBER ($SOURCE → $TARGET)"
    return
  fi
  local title
  title=$(pr_title)
  log "Creando PR: $title"
  gh pr create --base "$TARGET" --head "$SOURCE" --title "$title" \
    --body "PR generado por deploy.sh · $SOURCE → $TARGET"
  PR_NUMBER=$(gh pr list --head "$SOURCE" --base "$TARGET" --state open \
    --json number --jq '.[0].number')
  ok "PR #$PR_NUMBER creado"
}

watch_pipeline() {
  log "Monitoreando pipeline del PR #$PR_NUMBER (watch cada 10s, Ctrl+C solo corta el watch)"
  sleep 5
  if gh pr checks "$PR_NUMBER" --watch --interval 10; then
    ok "Pipeline del PR en verde"
  else
    if gh pr checks "$PR_NUMBER" 2>&1 | grep -qi 'no checks'; then
      warn "El PR no reporta checks; continúo"
    else
      die "Pipeline en rojo: revisa 'gh pr checks $PR_NUMBER' o la pestaña Actions"
    fi
  fi
}

confirm_merge() {
  if [[ ${AUTO_APPROVE:-0} == 1 ]]; then
    warn "Merge sin confirmación (AUTO_APPROVE=1)"
    return
  fi
  local prompt="¿Mergear PR #$PR_NUMBER ($SOURCE → $TARGET)?"
  [[ $TARGET == main ]] && prompt="${YELLOW}⚠ Esto dispara el release (publica a npm).${RESET} $prompt"
  read -r -p "$prompt [y/N] " reply
  [[ $reply =~ ^[yY]$ ]] || die "Merge cancelado"
}

merge_pr() {
  gh pr merge "$PR_NUMBER" --merge
  ok "PR #$PR_NUMBER mergeado en $TARGET"
}

watch_post_merge() {
  log "Buscando pipeline post-merge en $TARGET"
  sleep 8
  local run_id
  run_id=$(gh run list --branch "$TARGET" --limit 1 \
    --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
  if [[ -z $run_id ]]; then
    warn "No encontré runs en $TARGET; verifica Actions manualmente"
    return
  fi
  gh run watch "$run_id" --exit-status || die "Pipeline post-merge falló en $TARGET"
  ok "Pipeline post-merge en verde"
}

sync_local() {
  log "Sincronizando estado local con origin (fetch --prune)"
  git fetch origin --prune
  local current branch
  current=$(git branch --show-current)
  for branch in dev main; do
    git show-ref --verify --quiet "refs/remotes/origin/$branch" || continue
    if [[ $current == "$branch" ]]; then
      git pull --ff-only origin "$branch"
    elif ! git branch -f "$branch" "origin/$branch" 2>/dev/null; then
      warn "No pude actualizar $branch (¿checkout en otro worktree?); hazlo con 'git switch $branch && git pull --ff-only'"
      continue
    fi
    ok "Rama local $branch al día con origin/$branch"
  done
}

main() {
  validate_flow
  check_deps
  cd "$(git rev-parse --show-toplevel)"
  prepare_branch
  run_local_tests
  commit_changes
  push_branch
  ensure_pr
  watch_pipeline
  confirm_merge
  merge_pr
  watch_post_merge
  sync_local
  if [[ $TARGET == main ]]; then
    ok "Release completo: el workflow Release abre/actualiza el PR 'Version Packages'"
  else
    ok "Integración completa: $SOURCE ya está en $TARGET"
  fi
}

main
