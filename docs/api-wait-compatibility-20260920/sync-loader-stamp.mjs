import { edit } from './patch-utils.mjs';
edit('web/index.html', (source, replace) => {
  const family = ['phase8-formal-map.js', 'phase8-formal-map-dossier.js'];
  const tags = family.map(name => {
    const escaped = name.replaceAll('.', '\\.');
    const matches = [...source.matchAll(new RegExp('<script[^>]+src="' + escaped + '\\?v=([^"\\s]+)"[^>]*><\\/script>', 'g'))];
    if (matches.length !== 1) throw Error('Expected one family member: ' + name);
    return matches[0];
  });
  if (tags[0][1] === tags[1][1]) return source;
  const next = tags[1][0].replace('?v=' + tags[1][1], '?v=' + tags[0][1]);
  return replace(source, tags[1][0], next);
});
