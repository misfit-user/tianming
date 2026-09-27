import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
 s=r(s,'      var age = previous ? Date.now() - previous.at : Infinity;',`      var persisted = null, vault = TM.Endturn.RecoveryVault;
      if (!previous && vault) persisted = await vault.load(fingerprint, [root.GM._campaignId, root.GM._timelineId].join('|'));
      if (start !== sequence || root.GM !== txn.gmRef || root.P !== txn.pRef || generation() !== txn.loadGen) return false;
      if (persisted) previous = { fingerprint: persisted.fingerprint, gm: root.GM, p: root.P, generation: generation(), at: persisted.at, records: new Map(persisted.records) };
      var age = previous ? Date.now() - previous.at : Infinity;`);
 s=r(s,"fingerprint: s.fingerprint, at: s.at, records: s.records } : null;","fingerprint: s.fingerprint, world: s.world, at: s.at, records: s.records } : null;");
 s=r(s,"    active = null;\n  }\n  function lossless",`    active = null;
    var vault = TM.Endturn.RecoveryVault;
    if (vault) {
      if (retained) return vault.save({ version: 1, fingerprint: retained.fingerprint, world: retained.world, at: retained.at, records: Array.from(retained.records) });
      return vault.clear(s.fingerprint);
    }
  }
  function lossless`);
 s=r(s,'    sequence++; retained = null;','    sequence++; retained = null;\n    if (TM.Endturn.RecoveryVault) TM.Endturn.RecoveryVault.clear();');
 return s;
});
edit('web/tm-endturn-core.js',(s,r)=>{
 s=r(s,'if (_responseRecovery) _responseRecovery.finish(_turnTxn, "failed", error);','if (_responseRecovery) await _responseRecovery.finish(_turnTxn, "failed", error);');
 return r(s,"份完整响应，重试时校验一致后复用，刷新后失效。","份完整响应，重试时严格校验后复用；本地持久候选状态见耗时诊断。");
});
edit('web/index.html',(s,r)=>{const tag=s.match(/<script src="tm-endturn-response-recovery\.js[^\"]*"><\/script>/)[0];return r(s,tag,'<script src="tm-endturn-recovery-vault.js?v=20260919-complete"></script>\n'+tag);});
