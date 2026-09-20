import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js', s => s.replace(/(\r?\n)(?:\r?\n)+$/, '$1'));
edit('web/scripts/lint-renderer-writeback-boundaries.js', (s, r) => {
  s = r(s, 'const infraFunctions = functionsByName(infraParsed);', "const infraFunctions = functionsByName(infraParsed);\nconst retryFunctions = functionsByName(parse('tm-ai-infra-retry.js'));");
  return r(s, '  const fn = infraFunctions.get(name);', "  const fn = name === '_callAIMessagesStreamDirect' ? retryFunctions.get(name) : infraFunctions.get(name);\n  if (name === '_callAIMessagesStreamDirect') check(!infraFunctions.get(name), 'stream transport must have exactly one provider after relocation');");
});
