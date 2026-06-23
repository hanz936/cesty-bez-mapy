#!/usr/bin/env bash
# Per-funkční `deno check` pro edge funkce.
# Supabase doporučuje per-funkční config (žádný root/workspace deno.json — viz
# guides/functions/dependencies.mdx) → každou funkci kontrolujeme zvlášť s jejím
# deno.json (má-li bare importy), jinak config-less (--node-modules-dir=none, jen
# FQ esm.sh/npm: + relativní + std). Config se hledá od CWD, ne od cesty souboru
# (ověřeno empiricky), proto je --config u funkcí s bare importy nutný — jinak by
# se z rootu chytl kořenový package.json frontendu a bare importy se resolvly
# proti špatným verzím.
#
# Bez argumentů → _shared helpery + ecomail + email lib + VŠECHNY funkce (CI/Task 11).
# S argumenty   → jen uvedené funkce (per-task gate): npm run check:edge -- create-invoice
set -uo pipefail
fail=0
run() { echo "+ deno check $*"; deno check "$@" || fail=1; }

check_fn() {
  local dir="supabase/functions/$1/"
  if [ ! -f "${dir}index.ts" ]; then echo "skip: $1 (žádný index.ts)"; return; fi
  if [ -f "${dir}deno.json" ]; then
    run --config "${dir}deno.json" --node-modules-dir=none "${dir}index.ts"
  else
    run --node-modules-dir=none "${dir}index.ts"
  fi
}

if [ "$#" -gt 0 ]; then
  for fn in "$@"; do check_fn "$fn"; done
  exit $fail
fi

# Bez argumentů → celý strom
# 1) Standalone _shared helpery + generované typy (config-less)
run --node-modules-dir=none supabase/functions/_shared/*.ts
# 2) ecomail knihovna (config-less: FQ esm.sh + relativní + std)
run --node-modules-dir=none supabase/functions/_shared/ecomail/*.ts
# 3) email knihovna (bare react/resend/vokativ přes vlastní config)
run --config supabase/functions/_shared/email/deno.json --node-modules-dir=none \
  supabase/functions/_shared/email/sendEmail.ts
# 4) Každá funkce
for dir in supabase/functions/*/; do
  fn=$(basename "$dir")
  [ "$fn" = "_shared" ] && continue
  check_fn "$fn"
done

exit $fail
