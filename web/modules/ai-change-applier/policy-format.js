// Pure structured policy formatting. Extracted unchanged from core.
export function _aiPolicyText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

export function _aiPolicyAmount(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : (fallback || 0);
  }

export function _aiPolicyRegion(item) {
    item = item || {};
    return _aiPolicyText(item.regionName || item.region || item.target || item.regionId || item.province || '天下');
  }

export function _aiPolicyRatioLabel(value, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    if (!Number.isFinite(n)) n = 0.3;
    if (n <= 1) n = n * 10;
    n = Math.max(0, Math.min(10, Math.round(n)));
    return ['零','一','二','三','四','五','六','七','八','九','十'][n] || String(n);
  }

export function _aiStructuredPolicyText(field, item) {
    item = item || {};
    var explicit = _aiPolicyText(item.text || item.edictText || item.draftText || item.content || item.body);
    if (explicit) return explicit;
    var action = _aiPolicyText(item.action || item.type || item.kind || item.policyId).toLowerCase();
    var region = _aiPolicyRegion(item);
    var amount = _aiPolicyAmount(item.amount || item.money || item.silver, 0);

    if (field === 'currency_adjustments') {
      if (/full_currency_reform|currency_reform|silver_standard|coinage_reform/.test(action)) return '\u8bcf\u4ee4\uff1a\u63a8\u884c\u5b8c\u6574\u5e01\u5236\u6539\u9769\uff0c\u6821\u6b63\u94f6\u94b1\u6bd4\u4ef7\uff0c\u8d4b\u5f79\u6298\u94f6\uff0c\u4ee5\u5929\u4e0b\u4e00\u94b1\u6cd5\u3002';
      if (/regional_acceptance|paper_acceptance|acceptance/.test(action)) return '\u8bcf\u4ee4\uff1a\u4ee4' + region + '\u5148\u884c\u627f\u7528' + (item.paperName || item.name || '\u5b9d\u949e') + '\uff0c\u8bbe\u5151\u6362\u5b98\u5c40\uff0c\u7a33\u5176\u6c11\u95f4\u63a5\u53d7\u3002';
      if (/overseas_silver_flow|maritime_silver|silver_flow|overseas/.test(action)) return '\u8bcf\u4ee4\uff1a\u5f00\u6d77\u901a\u5546\uff0c\u5f15\u6d77\u5916\u94f6\u6d41\u5165' + region + '\uff0c\u5e76\u8bbe\u94f6\u4f30\u4ee5\u5e73\u5e02\u4ef7\u3002';
      if (/ban|private|mint|私铸|私钱|禁/.test(action)) return '诏令：严禁民间私铸，整饬钱法，搜检私钱作坊。';
      if (/issue|paper|发行|发钞|发/.test(action)) return '诏令：发行' + (item.paperName || item.name || '纸币') + (amount || 1000000) + '贯，准备金' + _aiPolicyRatioLabel(item.reserveRatio, 0.3) + '成。';
      if (/abolish|retire|废|罢|停/.test(action)) return '诏令：废止' + (item.paperName || item.name || '宝钞') + '，收回旧钞。';
      if (/debase|贬|减铸|轻钱/.test(action)) return '诏令：减铸' + (item.coinName || item.coinType || '铜钱') + _aiPolicyRatioLabel(item.level, 0.1) + '成，以纾军用。';
      return '';
    }

    if (field === 'population_adjustments') {
      if (/start_large_corvee|large_corvee|corvee|yaoyi/.test(action)) return '\u8bcf\u4ee4\uff1a\u5f81\u53d1\u5927\u5fad\u5f79' + (amount || 30000) + '\u4eba\uff0c\u6309\u6237\u7c4d\u6d3e\u5dee\uff0c\u4ee5\u4fee\u6cb3\u6e20\u57ce\u9632\u3002';
      if (/conscription|recruit|levy_soldier|zhaomu/.test(action)) return '\u8bcf\u4ee4\uff1a\u4e8e' + region + '\u5f81\u5175' + (amount || 10000) + '\u540d\uff0c\u6309' + (item.system || item.enable || '\u52df\u5175') + '\u5236\u8865\u5165\u519b\u7c4d\u3002';
      if (/migration_settlement|migrate|migration|settlement|relocate/.test(action)) return '\u8bcf\u4ee4\uff1a\u8fc1\u5f99\u5b89\u7f6e\u6d41\u6c11' + (amount || 5000) + '\u6237\uff0c\u62e8\u7530\u7ed9\u7cae\uff0c\u4ee4\u5165\u7c4d\u5b89\u4e1a\u3002';
      if (/hidden|purge|清查|隐户|漏籍/.test(action)) return '诏令：清查隐户，重编入黄籍。';
      if (/resettle|refugee|fugitive|招抚|逃户|流民/.test(action)) return '诏令：招抚逃户流民，令复业入籍。';
      if (/baojia|保甲|里甲/.test(action)) return '诏令：全国编设保甲，十户一牌。';
      if (/recount|register|huangce|黄册|重造|编审/.test(action)) return '诏令：重造黄册，清厘天下户籍。';
      return '';
    }

    if (field === 'central_local_actions') {
      if (/fiscal_bargain|bargain|local_fiscal/.test(action)) return '\u8bcf\u4ee4\uff1a\u4e0e' + region + '\u8bae\u5730\u65b9\u8d22\u653f\u535a\u5f08\uff0c\u660e\u8d77\u8fd0\u5b58\u7559\u4e4b\u5206\uff0c\u4ee5\u6355\u6350\u9977\u800c\u5b89\u5730\u65b9\u3002';
      if (/long_term_tracking|tracking|follow_up|monitor/.test(action)) return '\u8bcf\u4ee4\uff1a\u5efa\u7acb' + region + '\u957f\u671f\u8d22\u653f\u8ffd\u8e2a\uff0c\u9010\u6708\u6838\u5bf9\u8d77\u8fd0\u3001\u5b58\u7559\u3001\u6c11\u529b\u4e0e\u5b98\u8017\u3002';
      if (/transfer|grant|下拨|拨银|发帑|赈/.test(action)) return '诏令：下拨' + region + '银' + (amount || 50000) + '两赈济水灾。';
      if (/force|levy|强征|追征|催征/.test(action)) return '诏令：强征' + region + '地方留存' + (amount || 30000) + '两，以充军饷。';
      if (/censor|audit|监察|巡按|巡察/.test(action)) return '诏令：派监察御史巡按' + region + '，核其钱粮。';
      if (/allocation|share|分成|起运|存留|留成/.test(action)) return '诏令：调整' + region + '分成，起运' + _aiPolicyRatioLabel(item.qiyunRatio != null ? item.qiyunRatio : item.centralShare, 0.7) + '成，存留' + _aiPolicyRatioLabel(item.cunliuRatio != null ? item.cunliuRatio : item.retainedShare, 0.3) + '成。';
      return '';
    }

    if (field === 'environment_actions') {
      if (/migration_relief|migration|relocate|carry_capacity/.test(action)) return '\u8bcf\u4ee4\uff1a\u4ee4' + region + '\u8fc1\u6c11\u51fa\u5c71\uff0c\u9000\u8015\u8fd8\u6797\uff0c\u51cf\u8f7b\u5c71\u5730\u627f\u8f7d\u3002';
      if (/tech_investment|technology|water_tech|investment/.test(action)) return '\u8bcf\u4ee4\uff1a\u4e8e' + region + '\u6295\u5165\u6c34\u5229\u6280\u672f\u4e0e\u7701\u6c34\u519c\u5177\uff0c\u8bd5\u884c\u65b0\u6cd5\u4ee5\u590d\u7530\u529b\u3002';
      if (/disaster_recovery|recovery|restore|post_disaster/.test(action)) return '\u8bcf\u4ee4\uff1a\u884c' + region + '\u707e\u540e\u6062\u590d\u94fe\uff0c\u4fee\u5824\u3001\u6e05\u6de4\u3001\u590d\u8015\uff0c\u4e09\u5e74\u8003\u5176\u6210\u3002';
      if (/ban|logging|jin_hu|禁伐|禁樵/.test(action)) return '诏令：禁伐' + region + '山林，严禁樵采。';
      if (/dredge|water|shui|疏浚|水利|治水/.test(action)) return '诏令：疏浚' + region + '河道，兴修水利。';
      if (/reclaim|relief|tun|复耕|屯田|赈灾/.test(action)) return '诏令：赈灾复耕，屯田养地。';
      if (/fallow|rest|休耕|限垦|养地/.test(action)) return '诏令：限垦休耕，以养地力。';
      if (/open|waste|开荒|垦荒|垦殖/.test(action)) return '诏令：开荒' + region + '荒田，以增农亩。';
      return '';
    }

    if (field === 'institution_changes') {
      if (/abolish|remove|retire|废|罢|裁|撤|裁撤|废止/.test(action)) {
        var oldName = _aiPolicyText(item.officeName || item.name || item.institutionName || item.id || '旧司');
        return '诏令：裁撤' + oldName + '机构，归并职掌，罢其冗员。';
      }
      if (/create|add|register|office|设|立|置|创|新/.test(action)) {
        var name = _aiPolicyText(item.officeName || item.name || item.institutionName || '新司');
        return '诏令：设' + name + '，品级' + (item.rank || 5) + '，掌' + (item.duties || item.description || '专理新政') + '。';
      }
      return '';
    }
    return '';
  }

export function _aiStructuredPolicyParams(field, item) {
    item = item || {};
    var params = {};
    var action = _aiPolicyText(item.action || item.type || item.kind || item.policyId);
    if (action) params.action = action;
    if (item.regionId) params.regionId = item.regionId;
    if (item.region) params.region = item.region;
    if (item.sourceRegionId) params.sourceRegionId = item.sourceRegionId;
    if (item.targetRegionId) params.targetRegionId = item.targetRegionId;
    if (item.presetId || item.preset) params.presetId = item.presetId || item.preset;
    if (item.system || item.enable) params.system = item.system || item.enable;
    if (item.horizonTurns != null) params.horizonTurns = Number(item.horizonTurns);
    if (item.amount != null || item.money != null || item.silver != null) params.amount = _aiPolicyAmount(item.amount || item.money || item.silver, 0);
    if (field === 'currency_adjustments') {
      if (item.paperId) params.paperId = item.paperId;
      if (item.paperName || item.name) params.paperName = item.paperName || item.name;
      if (item.reserveRatio != null) params.reserveRatio = Number(item.reserveRatio);
      if (item.coinType) params.coinType = item.coinType;
      if (item.level != null) params.level = Number(item.level);
      if (item.acceptanceDelta != null) params.acceptanceDelta = Number(item.acceptanceDelta);
    } else if (field === 'central_local_actions') {
      if (item.qiyunRatio != null || item.centralShare != null) params.qiyunRatio = Number(item.qiyunRatio != null ? item.qiyunRatio : item.centralShare);
      if (item.cunliuRatio != null || item.retainedShare != null) params.cunliuRatio = Number(item.cunliuRatio != null ? item.cunliuRatio : item.retainedShare);
      if (item.retainedShare != null) params.retainedShare = Number(item.retainedShare);
      if (item.purpose) params.purpose = item.purpose;
      if (item.cost != null) params.cost = _aiPolicyAmount(item.cost, 0);
    } else if (field === 'environment_actions') {
      if (item.policyId) params.policyId = item.policyId;
    } else if (field === 'institution_changes') {
      params.officeName = item.officeName || item.name || item.institutionName || '';
      params.rank = item.rank || 5;
      params.duties = item.duties || item.description || '';
      if (item.region) params.region = item.region;
      if (item.staffSize != null) params.staffSize = _aiPolicyAmount(item.staffSize, 20);
      if (item.annualBudget != null) params.annualBudget = _aiPolicyAmount(item.annualBudget, 50000);
      if (item.fundingSource) params.fundingSource = item.fundingSource;
    }
    return params;
  }

export function _aiStructuredPolicyExpectedType(field) {
    return {
      currency_adjustments: 'currency_reform',
      population_adjustments: 'huji_reform',
      central_local_actions: 'central_local_finance',
      environment_actions: 'environment_policy',
      institution_changes: 'office_reform'
    }[field] || '';
  }
