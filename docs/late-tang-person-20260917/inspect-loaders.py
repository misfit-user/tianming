from pathlib import Path
import re
r=Path(__file__).resolve().parents[2]
for name in ['preload-impl.js','main-impl.js']:
 lines=(r/name).read_text(encoding='utf-8-sig').splitlines()
 for i,line in enumerate(lines):
  if re.search(r'loadScenario:|loadScenario\(|load-scenario|SCENARIOS_DIR|scenariosDir',line):
   print(name,i+1,'\n'.join(lines[max(0,i-2):i+8]))
