// 地名的短写：册页表格、色块里放不下「浙江承宣布政使司」，去掉官署后缀只留地名。全名放 title。
const SUFFIX = /(承宣)?布政使司$|都指挥使司.*$|宣慰(使)?司$|宣抚(使)?司$|安抚(使)?司$/;

export function provinceShort(name) {
  const s = String(name == null ? '' : name);
  const short = s.replace(SUFFIX, '');
  return short || s;
}
