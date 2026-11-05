// 钱的名目跟朝代走：明清是银、两，唐宋是钱、贯，秦汉是铜、钱。
// 名和单位都从内核取，和顶栏同一个口子（_moneyNoun、CurrencyUnit.getUnit），各册说的才是同一种钱。
const w = window;

export function money() {
  let noun = '银';
  let unit = '两';
  try {
    if (w.CurrencyUnit && w.CurrencyUnit.getUnit) unit = w.CurrencyUnit.getUnit().money || unit;
    if (typeof w._moneyNoun === 'function') noun = w._moneyNoun() || noun;
  } catch (_e) { /* 内核未齐时照默认 */ }
  return { noun, unit };
}
