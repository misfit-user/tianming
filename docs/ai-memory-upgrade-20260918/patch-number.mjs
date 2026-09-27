import { edit } from './patch-utils.mjs';
for (const file of [
  'web/tm-memory-envelope.js',
  'web/tm-memory-governance.js',
  'web/tm-memory-retrieval.js'
]) {
  edit(file, (source, replace) => replace(source,
    '  function numberOrNull(value) {\n    var n = Number(value);',
    '  function numberOrNull(value) {\n    if (value == null || value === "" || typeof value === "boolean") return null;\n    var n = Number(value);'
  ));
}
