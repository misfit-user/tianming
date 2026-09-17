from pathlib import Path
import json,datetime,time,subprocess,hashlib
w=Path(__file__).parent;r=w.parents[1]
layout=json.loads((w/'ui-pill-layout-installed.json').read_bytes())
assert hashlib.sha256((r/layout['file']).read_bytes()).hexdigest()==layout['after'],'UI changed after installation; recheck required'
cutoff=(w/'ui-pill-layout-installed.json').stat().st_mtime
for _ in range(200):
    native=json.loads((w/'runtime-full/report.json').read_bytes())
    started=datetime.datetime.fromisoformat(native['timing']['startedAt'].replace('Z','+00:00')).timestamp()
    if started>=cutoff and native.get('complete'):break
    time.sleep(1)
else:raise RuntimeError('Latest native report not completed')
assert native.get('ok') and not native['failures'],native['failures']
print('LATEST_NATIVE_PASS',len(native['results']),native['timing'],flush=True)
for filename in ['ui-final-verify.py','ui-final-checks.py']:
    completed=subprocess.run(['python','-X','utf8',str(w/filename)],cwd=r,capture_output=True,timeout=500)
    (w/(filename+'.log')).write_bytes(completed.stdout+b'\n'+completed.stderr)
    if completed.returncode:raise RuntimeError(filename+' failed; see captured log')
checks=json.loads((w/'ui-final-checks.json').read_bytes())
assert all(x['exitCode']==0 for x in checks),checks
source=r/'scenarios/晚唐·开成五年（官方）.json';source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
final={'completedAt':datetime.datetime.now().isoformat(),'sourceSha256':source_sha,'nativeCases':len(native['results']),'nativeReport':'runtime-full/report.json','finalCheckCommands':len(checks),'finalChecksPassed':True,'scope':'local scenario and associated runtime fixes; no commit/push/release/user save modifications','remainingSourceGaps':['洪辩','弥醯罗·蒲阇'],'fullProjectGatesGreen':False}
(w/'FINAL-VERIFICATION.json').write_text(json.dumps(final,ensure_ascii=False,indent=2),encoding='utf-8')
print('VERIFIED',json.dumps(final,ensure_ascii=False),flush=True)
report=f'''# 晚唐人物资料与官职修订：本地执行验收

核验时间：{final['completedAt']}。项目：`C:\\Users\\37814\\Desktop\\tianming`。
晚唐官方真源 SHA-256：`{source_sha}`。

## 已落地
434人保持原ID、顺序和姓名：81名史实人物、353名虚构人物。按适用性补充身份、家世、履历和行为资料；未知不伪造，玩家意志字段不强制填入。原数值、立绘、财富、关系和地图保持不变。
79名史实人物提供93段古籍原文，洪辩和弥醯罗·蒲阇的可靠原文仍显示待核。虚构人物不配伪造古籍。
正式人物图志新增“史料与校勘”。全文位于独立本地参考资产，后事不进入人物记忆或AI角色上下文；原文、来源、时点与校勘说明分开。
确定的官职/任所已校订。郑肃的河中节度使、河中尹、晋绛观察使与检校礼部尚书分开；李固言的实职与检校衔分开；杜悰、崔龟从等补入确定任职。
三处真实任命同步到总官制树、势力官制注册表和唐朝廷内部官制副本，避免开局重新载入旧副本。
官职显示按组成项去重；同一主职的重复导入不会再清空真实兼任；检校、追赠及判事职责不再凭包含某官名就误占实任职位。未考定任职者的职位不再自动猜人填入。
新增兼任标签保留忠诚圆环的空间，避免文字覆盖。

## 实际验收
最终真实Electron主程序/预加载/开局/人物页共{len(native['results'])}项检查通过；使用独立临时测试资料目录，外部网络被测试环境阻断，没有调用真实AI接口。
434人正式开局、三项任命及兼任保留、81个史料页（79有原文、2待核）、虚构人物边界、后事与AI上下文隔离、存档快照保留及原文不入快照均通过。
最终{len(checks)}条语法/专项/派生物检查命令通过，包含41条官职新回归断言、既有20条多官职显示断言、史料读取测试、官方同步检查、39条官方对账断言及目标文件git diff --check。
这不是完整长局或真实AI推演验收，也不是发布就绪证明。

## 仍需区分的整仓问题
本轮整仓架构门禁曾有5类失败，涉及其他模块的依赖/重复全局提供者/文件体积/脚本声明和旧备份引用等，日志保留，未提高基线或绕过门禁。
扩展官职套件记录42/43通过；唯一失败smoke-edict-office-tree-writeback.js的7条失败，用本轮修改前的官职模块只读重跑也能复现。人物图志8/8、品级6/6通过。未顺手改无关AI官制新建链路。
检测到绍宋真源同时被另一项本地工作修改，保留其当前版本，未拿旧备份覆盖；天启真源哈希未变。

## 使用与证据
重启本项目并新开晚唐局，在人物图志右侧的“史料与校勘”标签查看；标签栏可横向滚动。旧存档不强制回写开局官职或历史事实，以免抹掉玩家既有进程。官衔显示去重兼容旧的重复字段形态。
主要证据：`FINAL-VERIFICATION.json`、`ui-final-verification.json`、`ui-final-checks.json`、`runtime-full/report.json`、`runtime-full/source-coverage.json`；截图位于`runtime-full/emperor-sources.png`及`runtime-full/zheng-su-corrected.png`。
原始备份：项目根`.bak-tang-completion-20260917-173435`；后续各小补丁也保存写前字节与哈希。此前未完成的payload.b64没有参与导入，不应执行。
本轮没有Git提交、推送、打包或发版，也没有修改用户已有存档。修改针对本地开发项目，不等于已安装程序或线上版本自动更新。
'''
(w/'完成说明.md').write_text(report,encoding='utf-8')
print('REPORT_WRITTEN',str(w/'完成说明.md'))
with (w/'完成说明.md').open('a',encoding='utf-8') as f:
    f.write('\n## 测试期间的资源异常\n验证过程中曾记录一次渲染进程oom及一次crashed。最后一轮不并行运行大型生成器，测试主进程只保留断言所需字段，并在逐一访问81个人物页时让出渲染时隙，所有断言保留。该处理仅降低验收脚本的资源峰值，没有修改系统设置，也不等于宣称游戏所有内存/性能问题已修复。之前的异常报告保留在runtime-full/report-before-serial-memory-check.json及本轮记录中。\n')
