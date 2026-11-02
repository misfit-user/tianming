#!/bin/sh
# 新前端改动文件逐个过 esbuild 语法（check-imports 只查导入，查不出括号错）。从仓库根跑：sh tools/newui/syntax.sh
NM="${TM_NODE_MODULES:-E:/tianming-edict-efficacy-20260924/node_modules}"
bad=0
for f in $(git diff --name-only HEAD -- web/ui | grep '\.js$'; git ls-files --others --exclude-standard web/ui | grep '\.js$'); do
  "$NM/.bin/esbuild" "$f" --log-level=error > /dev/null || { echo "BAD $f"; bad=1; }
done
[ $bad = 0 ] && echo "[syntax] PASS"
exit $bad
