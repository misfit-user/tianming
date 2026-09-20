import { edit } from './patch-utils.mjs';
edit('web/tm-state-snapshot.js',(s,r)=>r(s,"    var e = new Error('时间快照操作未完成：' + stage);",`    var labels = { open: '打开数据库', write: '写入快照', keys: '读取快照索引', list: '读取时间线', 'lineage-read': '读取时间线谱系', 'lineage-write': '保存时间线谱系', read: '读取快照', cleanup: '清理旧快照', delete: '删除快照' };
    var message = code === 'SNAPSHOT_BLOCKED' ? '快照数据库升级被其他窗口阻塞' : '时间快照操作等待超时：' + (labels[stage] || stage);
    var e = new Error(message);`));
