# 给宋代史料解析结果补简体地名，供与绍宋剧本的简体地名比对：
#   《宋史·地理志》songshi-dili-*.json：nameS、circuitS、subCircuitS、countiesS
#   《文献通考》商税表、《元丰九域志》等只有 name 的表：nameS（九域志另补 circuitS）
# 用法：python songshi-simplify.py <json>...（原地改写）。依赖 opencc（pip install opencc）。
import json
import sys

import opencc

cc = opencc.OpenCC('t2s')
# opencc 不处理的异体字
VARIANTS = str.maketrans({
    '靑': '青', '淸': '清', '鎭': '镇', '髙': '高', '巗': '岩', '甯': '宁', '眞': '真',
    '緖': '绪', '爲': '为', '衞': '卫', '戸': '户', '嶲': '巂',
    '夀': '寿', '衛': '卫', '隂': '阴', '懐': '怀', '寜': '宁', '徳': '德',
})
# 维基文库原文的个别讹字
TYPOS = {'觌焉陵': '鄢陵', '里安府': '瑞安府'}


def simplify(text):
    text = TYPOS.get(text, text)
    return cc.convert(text.translate(VARIANTS))


def main(path):
    with open(path, encoding='utf-8') as f:
        rows = json.load(f)
    # 九域志乡数表是「州 → {县: 乡数}」字典：键名整体换成简体（异体归一后同名的合并）
    if isinstance(rows, dict):
        out = {}
        for prefecture, counties in rows.items():
            out.setdefault(simplify(prefecture), {}).update({simplify(c): n for c, n in counties.items()})
        rows = out
    for r in (rows if isinstance(rows, list) else []):
        r['nameS'] = simplify(r['name'])
        for key in ('circuit', 'subCircuit'):
            if key in r:
                r[key + 'S'] = simplify(r[key])
        if 'counties' in r:
            r['countiesS'] = [simplify(c) for c in r['counties']]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    for p in sys.argv[1:]:
        main(p)
