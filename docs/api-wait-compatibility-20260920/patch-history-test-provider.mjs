import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-tc-history-wave.js', (source, replace) => {
  const anchor = "  vm.runInContext(agentKernel, sb, { filename: 'agent-kernel' });";
  const addition = "  // Load the same wait-setting validator used by the real startup path; do not stub away runtime checks.\n"
    + "  const waitSettingSource = require('./lib-perf-round1').functionSource(R('tm-ai-infra-retry.js'), '_aiWaitSetting');\n"
    + "  vm.runInContext(waitSettingSource, sb, { filename: 'real-ai-wait-setting' });\n";
  return replace(source, anchor, addition + anchor);
});
