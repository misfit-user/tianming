import fs from 'node:fs';
import {edit} from './patch-utils.mjs';
edit('web/tm-api-settings.js', (s, r) => {
  s = r(s, '    options.append(thinkingLabel, protocolLabel, protocol, hint);', '    options.append(thinkingLabel, protocolLabel, protocol, hint);\n' + fs.readFileSync('docs/api-wait-compatibility-20260920/settings.fragment.txt', 'utf8'));
  return r(s, '    var owner = { cancel:cancel, detect:detect, read: function(target) {', '    var owner = { cancel:cancel, detect:detect, read: function(target) {\n      var firstMs = readDuration(firstWait), totalMs = readDuration(totalWait), agentMs = agentWait ? readDuration(agentWait) : 0;\n      target.firstResponseTimeoutMs = firstMs; target.totalResponseTimeoutMs = totalMs;\n      if (agentWait) target.agentRunTimeoutMs = agentMs;');
});
