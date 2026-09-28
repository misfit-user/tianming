from pathlib import Path
import json
w=Path(__file__).parent;r=w.parents[1]
d=json.loads((r/'web/dev-tools/arch-guard/ci-u3lzg5/smoke-report.json').read_bytes())
print('SUMMARY',d['summary'])
print('RESULT_KEYS',list(d['results'][0]))
for row in d['results']:
 if any(n in str(row.get('file',row.get('name',''))) for n in ['military-execution-binding','start-game-data-integrity','runtime-save-consistency']):
  print(json.dumps(row,ensure_ascii=False)[-9000:])
