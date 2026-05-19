extends RefCounted

class_name MonthlySimulator

func preview_month(state: RefCounted) -> Dictionary:
	var summary: Dictionary = _dict(state.get("summary"))
	var guoku_money_before: float = _number(state.get("guoku_money"))
	var guoku_grain_before: float = _number(state.get("guoku_grain"))
	var neitang_money_before: float = _number(state.get("neitang_money"))
	var regional: Dictionary = _preview_regions(state)
	var population: Dictionary = _preview_population(state, regional)

	var guoku_money_income: float = _number(summary.get("guoku_income_money", 0))
	var guoku_money_expense: float = _number(summary.get("guoku_expense_money", 0))
	var guoku_grain_income: float = _number(summary.get("guoku_income_grain", 0))
	var guoku_grain_expense: float = _number(summary.get("guoku_expense_grain", 0))
	var neitang_money_income: float = _number(summary.get("neitang_income_money", 0))
	var neitang_money_expense: float = _number(summary.get("neitang_expense_money", 0))

	var guoku_money_delta: float = guoku_money_income - guoku_money_expense
	var guoku_grain_delta: float = guoku_grain_income - guoku_grain_expense
	var neitang_money_delta: float = neitang_money_income - neitang_money_expense
	var guoku_money_shortfall: float = maxf(0.0, -(guoku_money_before + guoku_money_delta))
	var military: Dictionary = _preview_military(state, guoku_money_delta, guoku_money_shortfall)
	var faction_ai: Dictionary = _preview_faction_ai_pressure(
		state,
		regional,
		military,
		guoku_money_before,
		guoku_grain_before,
		guoku_money_delta,
		guoku_grain_delta
	)
	regional = _dict(faction_ai.get("regional_after", regional))
	military = _dict(faction_ai.get("military_after", military))
	var uprising: Dictionary = _preview_uprisings(state, regional, population, military)
	var authority: Dictionary = _preview_authority(state, military, uprising)
	var events: Dictionary = _preview_events(state)

	var report: Dictionary = {
		"settled": false,
		"turn": int(_number(state.get("turn"))),
		"year": int(_number(state.get("year"))),
		"month": int(_number(state.get("month"))),
		"guoku_money_before": guoku_money_before,
		"guoku_money_income": guoku_money_income,
		"guoku_money_expense": guoku_money_expense,
		"guoku_money_delta": guoku_money_delta,
		"guoku_money_after": maxf(0.0, guoku_money_before + guoku_money_delta),
		"guoku_money_shortfall": guoku_money_shortfall,
		"guoku_grain_before": guoku_grain_before,
		"guoku_grain_income": guoku_grain_income,
		"guoku_grain_expense": guoku_grain_expense,
		"guoku_grain_delta": guoku_grain_delta,
		"guoku_grain_after": maxf(0.0, guoku_grain_before + guoku_grain_delta),
		"guoku_grain_shortfall": maxf(0.0, -(guoku_grain_before + guoku_grain_delta)),
		"neitang_money_before": neitang_money_before,
		"neitang_money_income": neitang_money_income,
		"neitang_money_expense": neitang_money_expense,
		"neitang_money_delta": neitang_money_delta,
		"neitang_money_after": maxf(0.0, neitang_money_before + neitang_money_delta),
		"neitang_money_shortfall": maxf(0.0, -(neitang_money_before + neitang_money_delta))
	}
	report.merge(military, true)
	report.merge(regional, true)
	report.merge(population, true)
	report.merge(_dict(faction_ai.get("report", {})), true)
	report.merge(uprising, true)
	report.merge(authority, true)
	report.merge(events, true)
	return report

func settle_month(state: RefCounted) -> Dictionary:
	var report: Dictionary = preview_month(state)
	report["settled"] = true
	state.set("guoku_money", _number(report.get("guoku_money_after", 0)))
	state.set("guoku_grain", _number(report.get("guoku_grain_after", 0)))
	state.set("neitang_money", _number(report.get("neitang_money_after", 0)))
	state.set("population_registered", _number(report.get("population_registered_after", state.get("population_registered"))))
	state.set("population_hidden", _number(report.get("population_hidden_after", state.get("population_hidden"))))
	state.set("huangquan", _number(report.get("huangquan_after", state.get("huangquan"))))
	state.set("huangwei", _number(report.get("huangwei_after", state.get("huangwei"))))
	state.set("minxin", _number(report.get("minxin_after", state.get("minxin"))))
	state.set("factions", _array(report.get("factions_after", state.get("factions"))).duplicate(true))
	state.set("map_regions", _array(report.get("regions_after", [])).duplicate(true))
	state.set("event_queue", _array(report.get("event_queue_after", state.get("event_queue"))).duplicate(true))
	state.set("triggered_event_ids", _dict(report.get("triggered_event_ids_after", state.get("triggered_event_ids"))).duplicate(true))
	if state.has_method("set_variable_value"):
		state.call("set_variable_value", "流民数量", _number(report.get("refugee_after", 0)))
		state.call("set_variable_value", "辽饷积欠", _number(report.get("liao_arrears_after", 0)))
		state.call("set_variable_value", "九边欠饷总数", _number(report.get("jiubian_arrears_after", 0)))
		state.call("set_variable_value", "辽东防线稳固度", _number(report.get("liaodong_frontier_after", 0)))
	return report

func report_text(report: Dictionary) -> String:
	if report.is_empty():
		return "月度结算尚未开始"

	var prefix: String = "已结算" if bool(report.get("settled", false)) else "本月预计"
	var date_text: String = "%d年%d月" % [
		int(_number(report.get("year", 0))),
		int(_number(report.get("month", 0)))
	]
	var parts: PackedStringArray = PackedStringArray([
		"%s %s" % [date_text, prefix],
		"国库银 %s" % _signed_big(_number(report.get("guoku_money_delta", 0)), "两"),
		"国库粮 %s" % _signed_big(_number(report.get("guoku_grain_delta", 0)), "石"),
		"内帑 %s" % _signed_big(_number(report.get("neitang_money_delta", 0)), "两"),
		"辽饷 %s" % _signed_big(_number(report.get("liao_arrears_delta", 0)), "万两"),
		"皇威 %s" % _signed_big(_number(report.get("huangwei_delta", 0)), ""),
		"在籍 %s" % _signed_big(_number(report.get("population_registered_delta", 0)), "口"),
		"流民 %s" % _signed_big(_number(report.get("refugee_delta", 0)), "口"),
		"民心 %s" % _signed_big(_number(report.get("minxin_delta", 0)), ""),
		"起义 +%d" % _array(report.get("uprisings", [])).size(),
		"事件 +%d" % _array(report.get("events", [])).size()
	])

	var warnings: PackedStringArray = PackedStringArray()
	if _number(report.get("guoku_money_shortfall", 0)) > 0.0:
		warnings.append("国库银亏空 %s" % fmt_big(_number(report.get("guoku_money_shortfall", 0)), "两"))
	if _number(report.get("guoku_grain_shortfall", 0)) > 0.0:
		warnings.append("国库粮亏空 %s" % fmt_big(_number(report.get("guoku_grain_shortfall", 0)), "石"))
	if _number(report.get("neitang_money_shortfall", 0)) > 0.0:
		warnings.append("内帑亏空 %s" % fmt_big(_number(report.get("neitang_money_shortfall", 0)), "两"))
	if warnings.size() > 0:
		parts.append("；".join(warnings))

	return "；".join(parts)

func _preview_events(state: RefCounted) -> Dictionary:
	var event_deck: Array = _array(state.get("event_deck"))
	var event_queue: Array = _array(state.get("event_queue")).duplicate(true)
	var triggered_event_ids: Dictionary = _dict(state.get("triggered_event_ids")).duplicate(true)
	var current_turn: int = int(_number(state.get("turn")))
	var triggered_this_month: Array = []

	for priority in ["rigid", "conditional"]:
		for raw in event_deck:
			var event: Dictionary = _dict(raw)
			if not _event_matches_priority(event, priority):
				continue
			var event_id: String = str(event.get("id", event.get("name", "")))
			if event_id.is_empty() or triggered_event_ids.has(event_id):
				continue
			if not _event_due(event, current_turn, state):
				continue
			var queued: Dictionary = _event_notice(event, current_turn)
			event_queue.append(queued)
			triggered_this_month.append(queued)
			triggered_event_ids[event_id] = true

	return {
		"events": triggered_this_month,
		"event_queue_after": event_queue,
		"triggered_event_ids_after": triggered_event_ids
	}

func _event_matches_priority(event: Dictionary, priority: String) -> bool:
	var source: String = str(event.get("source", ""))
	match priority:
		"rigid":
			return source == "rigid_trigger" or source == "rigid_history"
		"conditional":
			return source == "events"
		_:
			return false

func _event_due(event: Dictionary, current_turn: int, state: RefCounted) -> bool:
	var source: String = str(event.get("source", ""))
	if source == "rigid_trigger" or source == "rigid_history":
		var trigger_turn: int = int(_number(event.get("trigger_turn", 0)))
		return trigger_turn > 0 and trigger_turn <= current_turn
	if source != "events":
		return false
	var event_type: String = str(event.get("type", ""))
	var category: String = str(event.get("category", ""))
	if event_type != "conditional" and category != "conditional":
		return false
	return _trigger_expression_matches(str(event.get("trigger", "")), state)

func _trigger_expression_matches(trigger: String, state: RefCounted) -> bool:
	var expression: String = trigger.strip_edges()
	if expression.is_empty():
		return false
	expression = _strip_trigger_notes(expression)
	var or_parts: Array = _split_top_level_expression(expression, "或")
	for raw_or in or_parts:
		if _trigger_and_part_matches(str(raw_or), state):
			return true
	return false

func _trigger_and_part_matches(expression: String, state: RefCounted) -> bool:
	var and_parts: Array = _split_top_level_expression(_strip_wrapping_parentheses(expression), "且")
	if and_parts.is_empty():
		return false
	for raw_condition in and_parts:
		if not _trigger_condition_matches(str(raw_condition), state):
			return false
	return true

func _trigger_condition_matches(condition: String, state: RefCounted) -> bool:
	var text: String = _strip_wrapping_parentheses(condition)
	if text.is_empty():
		return false
	if _trigger_expression_has_top_level_operator(text):
		return _trigger_expression_matches(text, state)
	var operators: Array = [">=", "<=", ">", "<", "==", "="]
	for raw_operator in operators:
		var operator_text: String = str(raw_operator)
		var operator_index: int = text.find(operator_text)
		if operator_index < 0:
			continue
		var left: String = text.substr(0, operator_index).strip_edges()
		var right_text: String = text.substr(operator_index + operator_text.length()).strip_edges()
		var left_value: float = _trigger_value(state, left, right_text)
		var right_value: float = _number(right_text)
		match operator_text:
			">=":
				return left_value >= right_value
			"<=":
				return left_value <= right_value
			">":
				return left_value > right_value
			"<":
				return left_value < right_value
			_:
				return is_equal_approx(left_value, right_value)
	return _bare_trigger_predicate_matches(text, state)

func _strip_trigger_notes(expression: String) -> String:
	var text: String = expression.strip_edges()
	if text.contains("·已"):
		text = text.split("·已", true, 1)[0].strip_edges()
	return text

func _strip_wrapping_parentheses(expression: String) -> String:
	var text: String = expression.strip_edges()
	var changed: bool = true
	while changed and text.length() >= 2:
		changed = false
		var first: String = text.substr(0, 1)
		var last: String = text.substr(text.length() - 1, 1)
		if (first == "（" and last == "）") or (first == "(" and last == ")"):
			text = text.substr(1, text.length() - 2).strip_edges()
			changed = true
	return text

func _split_top_level_expression(expression: String, separator: String) -> Array:
	var parts: Array = []
	var text: String = expression.strip_edges()
	var depth: int = 0
	var start: int = 0
	for i in range(text.length()):
		var ch: String = text.substr(i, 1)
		if ch == "（" or ch == "(":
			depth += 1
		elif ch == "）" or ch == ")":
			depth = maxi(0, depth - 1)
		elif depth == 0 and ch == separator:
			var part: String = text.substr(start, i - start).strip_edges()
			if not part.is_empty():
				parts.append(part)
			start = i + separator.length()
	var tail: String = text.substr(start).strip_edges()
	if not tail.is_empty():
		parts.append(tail)
	return parts

func _trigger_expression_has_top_level_operator(expression: String) -> bool:
	return _split_top_level_expression(expression, "或").size() > 1 or _split_top_level_expression(expression, "且").size() > 1

func _bare_trigger_predicate_matches(text: String, state: RefCounted) -> bool:
	var predicate: String = text.strip_edges()
	if predicate.is_empty():
		return false
	if predicate.ends_with("在职"):
		return _character_active_in_office(state, predicate.trim_suffix("在职"))
	if predicate.ends_with("在朝"):
		return _character_active_in_office(state, predicate.trim_suffix("在朝"))
	if predicate.ends_with("存在"):
		return not _character_by_trigger_name(state, predicate.trim_suffix("存在")).is_empty()
	if predicate.ends_with("仍存"):
		return _faction_or_character_exists(state, predicate.trim_suffix("仍存"))
	if predicate.begins_with("第 ") and predicate.contains("回合"):
		return _number(predicate) <= _number(state.get("turn"))
	if predicate.contains("开局即发"):
		return _number(state.get("turn")) <= 1.0
	if _is_season_predicate(predicate):
		return _season_predicate_matches(state, predicate)
	if state.has_method("variable_value"):
		return _number(state.call("variable_value", predicate)) > 0.0
	return false

func _character_active_in_office(state: RefCounted, raw_name: String) -> bool:
	var character: Dictionary = _character_by_trigger_name(state, raw_name)
	if character.is_empty():
		return false
	var title: String = str(character.get("official_title", character.get("officialTitle", character.get("title", ""))))
	var inactive_markers: Array = ["已罢", "闲居", "丁忧", "候任", "告归", "养病", "致仕", "下狱", "被逮", "罢官"]
	for marker in inactive_markers:
		if title.contains(str(marker)):
			return false
	return not title.strip_edges().is_empty()

func _faction_or_character_exists(state: RefCounted, raw_name: String) -> bool:
	var name: String = raw_name.strip_edges()
	if not _character_by_trigger_name(state, name).is_empty():
		return true
	if state.has_method("faction_by_name") and not _dict(state.call("faction_by_name", name)).is_empty():
		return true
	return false

func _character_by_trigger_name(state: RefCounted, raw_name: String) -> Dictionary:
	var name: String = raw_name.strip_edges()
	if name.is_empty():
		return {}
	if state.has_method("character_by_name"):
		var exact: Dictionary = _dict(state.call("character_by_name", name))
		if not exact.is_empty():
			return exact
	var candidates: Array = [name]
	if name.contains("·"):
		candidates.append(name.split("·", false)[name.split("·", false).size() - 1])
	var rows: Array = _array(state.get("characters"))
	for raw_candidate in candidates:
		var candidate: String = str(raw_candidate)
		for raw in rows:
			var character: Dictionary = _dict(raw)
			var character_name: String = str(character.get("name", ""))
			var title: String = str(character.get("title", character.get("officialTitle", character.get("official_title", ""))))
			if character_name == candidate or character_name.contains(candidate) or title.contains(candidate):
				return character
	return {}

func _is_season_predicate(predicate: String) -> bool:
	return ["春季", "夏季", "秋季", "冬季", "正月", "一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "十一月", "腊月", "十二月"].has(predicate)

func _season_predicate_matches(state: RefCounted, predicate: String) -> bool:
	var month_num: int = int(_number(state.get("month")))
	if month_num <= 0:
		return false
	match predicate:
		"春季":
			return month_num >= 1 and month_num <= 3
		"夏季":
			return month_num >= 4 and month_num <= 6
		"秋季":
			return month_num >= 7 and month_num <= 9
		"冬季":
			return month_num >= 10 and month_num <= 12
		"正月", "一月":
			return month_num == 1
		"二月":
			return month_num == 2
		"三月":
			return month_num == 3
		"四月":
			return month_num == 4
		"五月":
			return month_num == 5
		"六月":
			return month_num == 6
		"七月":
			return month_num == 7
		"八月":
			return month_num == 8
		"九月":
			return month_num == 9
		"十月":
			return month_num == 10
		"冬月", "十一月":
			return month_num == 11
		"腊月", "十二月":
			return month_num == 12
	return false

func _trigger_value(state: RefCounted, name: String, right_text: String = "") -> float:
	var key: String = name.strip_edges()
	match key:
		"皇权":
			return _number(state.get("huangquan"))
		"皇威":
			return _number(state.get("huangwei"))
		"民心":
			return _number(state.get("minxin"))
		"帑廪余银", "帑廪", "国库银", "国库":
			return _number(state.get("guoku_money")) / 10000.0 if right_text.contains("万") else _number(state.get("guoku_money"))
		"内帑", "内帑余银":
			return _number(state.get("neitang_money")) / 10000.0 if right_text.contains("万") else _number(state.get("neitang_money"))
	var world_lookup: Dictionary = _world_state_trigger_value(state, key)
	if bool(world_lookup.get("ok", false)):
		return _number(world_lookup.get("value", 0))
	var faction_lookup: Dictionary = _faction_trigger_value(state, key)
	if bool(faction_lookup.get("ok", false)):
		return _number(faction_lookup.get("value", 0))
	if state.has_method("variable_value"):
		return _number(state.call("variable_value", key))
	return 0.0

func _world_state_trigger_value(state: RefCounted, key: String) -> Dictionary:
	match key:
		"月份", "月":
			return _trigger_lookup(state.get("month"))
		"年份", "年":
			return _trigger_lookup(state.get("year"))
		"回合", "当前回合":
			return _trigger_lookup(state.get("turn"))
		"民心":
			return _trigger_lookup(state.get("minxin"))
		"在籍人口", "编户人口":
			return _trigger_lookup(state.get("population_registered"))
		"隐户", "隐匿人口":
			return _trigger_lookup(state.get("population_hidden"))
	var variable_aliases: Dictionary = {
		"流民": "流民数量",
		"流民数量": "流民数量",
		"辽饷": "辽饷积欠",
		"辽饷积欠": "辽饷积欠",
		"九边欠饷": "九边欠饷总数",
		"九边欠饷总数": "九边欠饷总数",
		"辽东防线": "辽东防线稳固度",
		"辽东防线稳固度": "辽东防线稳固度",
	}
	if variable_aliases.has(key):
		return _trigger_lookup(_variable_value(state, str(variable_aliases.get(key, ""))))
	return {"ok": false, "value": 0.0}

func _faction_trigger_value(state: RefCounted, key: String) -> Dictionary:
	var rules: Array = [
		{"suffix": "边境紧张度", "fields": ["border_tension"]},
		{"suffix": "边境紧张", "fields": ["border_tension"]},
		{"suffix": "敌意", "fields": ["hostility"]},
		{"suffix": "对明关系", "fields": ["relation_to_player", "relation", "relationship"]},
		{"suffix": "对玩家关系", "fields": ["relation_to_player", "relation", "relationship"]},
		{"suffix": "关系", "fields": ["relation_to_player", "relation", "relationship"]},
		{"suffix": "凝聚力", "fields": ["cohesion", "military_cohesion"]},
		{"suffix": "凝聚", "fields": ["cohesion", "military_cohesion"]},
		{"suffix": "军队凝聚", "fields": ["military_cohesion", "cohesion"]},
		{"suffix": "军心", "fields": ["military_cohesion", "cohesion"]},
		{"suffix": "军力", "fields": ["military_strength", "army_strength", "strength"]},
		{"suffix": "兵力", "fields": ["military_strength", "army_strength", "troops"]},
		{"suffix": "实力", "fields": ["strength", "military_strength"]},
		{"suffix": "国力", "fields": ["strength", "military_strength"]},
		{"suffix": "民望", "fields": ["public_opinion", "popular_support", "support"]},
		{"suffix": "民心", "fields": ["public_opinion", "popular_support", "support"]},
		{"suffix": "贸易", "fields": ["trade_access", "trade"]},
		{"suffix": "通商", "fields": ["trade_access", "trade"]},
		{"suffix": "朝贡压力", "fields": ["tribute_pressure"]},
		{"suffix": "明援", "fields": ["ming_support"]},
	]
	for raw_rule in rules:
		var rule: Dictionary = _dict(raw_rule)
		var suffix: String = str(rule.get("suffix", ""))
		if suffix.is_empty() or not key.ends_with(suffix):
			continue
		var faction_name: String = key.trim_suffix(suffix).strip_edges()
		var faction: Dictionary = _faction_by_trigger_name(state, faction_name)
		if faction.is_empty():
			continue
		for raw_field in _array(rule.get("fields", [])):
			var field: String = str(raw_field)
			if faction.has(field):
				return _trigger_lookup(faction.get(field, 0))
		return _trigger_lookup(0.0)
	return {"ok": false, "value": 0.0}

func _faction_by_trigger_name(state: RefCounted, raw_name: String) -> Dictionary:
	var name: String = raw_name.strip_edges()
	if name.is_empty():
		return {}
	if state.has_method("faction_by_name"):
		var exact: Dictionary = _dict(state.call("faction_by_name", name))
		if not exact.is_empty():
			return exact
	var candidates: Array = [name]
	if name.contains("·"):
		var parts: PackedStringArray = name.split("·", false)
		if parts.size() > 0:
			candidates.append(parts[parts.size() - 1])
	if name.ends_with("部"):
		candidates.append(name.trim_suffix("部"))
	for raw_candidate in candidates:
		var candidate: String = str(raw_candidate).strip_edges()
		if candidate.is_empty():
			continue
		for raw in _array(state.get("factions")):
			var faction: Dictionary = _dict(raw)
			var labels: Array = [
				str(faction.get("name", "")),
				str(faction.get("id", "")),
				str(faction.get("title", "")),
				str(faction.get("leader", "")),
			]
			for raw_label in labels:
				var label: String = str(raw_label).strip_edges()
				if label.is_empty():
					continue
				if label == candidate or label.contains(candidate) or candidate.contains(label):
					return faction
	return {}

func _trigger_lookup(value: Variant) -> Dictionary:
	return {"ok": true, "value": _number(value)}

func _event_notice(event: Dictionary, current_turn: int) -> Dictionary:
	return {
		"id": str(event.get("id", event.get("name", ""))),
		"name": str(event.get("name", "")),
		"type": str(event.get("type", "")),
		"source": str(event.get("source", "")),
		"trigger": str(event.get("trigger", "")),
		"trigger_turn": int(_number(event.get("trigger_turn", 0))),
		"queued_turn": current_turn,
		"effect": str(event.get("effect", "")),
		"effect_data": _dict(event.get("effect_data", {})).duplicate(true),
		"choices": _array(event.get("choices", [])).duplicate(true),
		"description": str(event.get("description", "")),
		"narrative": str(event.get("narrative", event.get("description", "")))
	}

func _preview_authority(state: RefCounted, military: Dictionary, uprising: Dictionary) -> Dictionary:
	var huangquan_before: float = _number(state.get("huangquan"))
	var huangwei_before: float = _number(state.get("huangwei"))
	var huangquan_delta: float = 0.0
	var huangwei_delta: float = 0.0
	var reasons: Array = []

	var military_alerts: Array = _array(military.get("military_alerts", []))
	if military_alerts.size() > 0:
		var military_penalty: float = minf(2.0, float(military_alerts.size()) * 0.75)
		huangwei_delta -= military_penalty
		reasons.append("欠饷与边防告警")
	if _number(military.get("liaodong_frontier_after", 100)) <= 30.0:
		huangwei_delta -= 1.0
		reasons.append("辽东防线低于三成")
	if bool(uprising.get("uprising_created", false)):
		huangwei_delta -= 3.0
		reasons.append("地方起义成势")

	huangwei_delta = clampf(huangwei_delta, -6.0, 1.0)
	return {
		"huangquan_before": huangquan_before,
		"huangquan_after": clampf(huangquan_before + huangquan_delta, 0.0, 100.0),
		"huangquan_delta": huangquan_delta,
		"huangwei_before": huangwei_before,
		"huangwei_after": clampf(huangwei_before + huangwei_delta, 0.0, 100.0),
		"huangwei_delta": huangwei_delta,
		"authority_reasons": reasons
	}

func _preview_military(state: RefCounted, guoku_money_delta: float, guoku_money_shortfall: float) -> Dictionary:
	var factions_after: Array = _array(state.get("factions")).duplicate(true)
	var liao_before: float = _variable_value(state, "辽饷积欠")
	var jiubian_before: float = _variable_value(state, "九边欠饷总数")
	var frontier_before: float = _variable_value(state, "辽东防线稳固度")
	var monthly_deficit_wan: float = maxf(0.0, -guoku_money_delta) / 10000.0
	var shortfall_wan: float = maxf(0.0, guoku_money_shortfall) / 10000.0

	var liao_delta: float = maxf(0.0, monthly_deficit_wan * 0.08 + shortfall_wan * 0.45 + maxf(0.0, liao_before - 400.0) * 0.002)
	var jiubian_delta: float = maxf(0.0, monthly_deficit_wan * 0.12 + shortfall_wan * 0.65 + maxf(0.0, jiubian_before - 700.0) * 0.002)
	var liao_after: float = clampf(liao_before + liao_delta, 0.0, 1000.0)
	var jiubian_after: float = clampf(jiubian_before + jiubian_delta, 0.0, 2000.0)
	var frontier_delta: float = -clampf(maxf(0.0, liao_after - 400.0) / 150.0 + maxf(0.0, jiubian_after - 900.0) / 300.0, 0.0, 2.0)
	var frontier_after: float = clampf(frontier_before + frontier_delta, 0.0, 100.0)
	var military_cohesion_delta: float = -clampf(maxf(0.0, liao_after - 350.0) / 350.0 + maxf(0.0, jiubian_after - 650.0) / 500.0 + shortfall_wan / 200.0, 0.0, 2.0)

	for i in range(factions_after.size()):
		var faction: Dictionary = _dict(factions_after[i]).duplicate(true)
		if str(faction.get("name", "")) != "明朝廷":
			continue
		faction["military_cohesion"] = clampf(_number(faction.get("military_cohesion", faction.get("cohesion", 50))) + military_cohesion_delta, 0.0, 100.0)
		faction["cohesion"] = clampf(_number(faction.get("cohesion", 50)) + military_cohesion_delta * 0.35, 0.0, 100.0)
		factions_after[i] = faction

	var alerts: Array = []
	if liao_after >= 600.0:
		alerts.append("辽饷积欠逼近兵变线")
	if jiubian_after >= 1000.0:
		alerts.append("九边欠饷逼近全面哗变线")
	if frontier_after <= 35.0:
		alerts.append("辽东防线动摇")

	return {
		"factions_after": factions_after,
		"liao_arrears_before": liao_before,
		"liao_arrears_after": liao_after,
		"liao_arrears_delta": liao_after - liao_before,
		"jiubian_arrears_before": jiubian_before,
		"jiubian_arrears_after": jiubian_after,
		"jiubian_arrears_delta": jiubian_after - jiubian_before,
		"liaodong_frontier_before": frontier_before,
		"liaodong_frontier_after": frontier_after,
		"liaodong_frontier_delta": frontier_after - frontier_before,
		"ming_military_cohesion_delta": military_cohesion_delta,
		"military_alerts": alerts
	}

func _preview_faction_ai_pressure(
	state: RefCounted,
	regional: Dictionary,
	military: Dictionary,
	guoku_money_before: float,
	guoku_grain_before: float,
	guoku_money_delta: float,
	guoku_grain_delta: float
) -> Dictionary:
	var regional_after: Dictionary = regional.duplicate(true)
	var military_after: Dictionary = military.duplicate(true)
	var regions_after: Array = _array(regional_after.get("regions_after", state.get("map_regions"))).duplicate(true)
	var factions_after: Array = _array(military_after.get("factions_after", state.get("factions"))).duplicate(true)
	var actions: Array = []
	var raid_money_delta: float = 0.0
	var raid_grain_delta: float = 0.0
	var later_jin_index: int = _faction_index_by_name(factions_after, "后金")
	var later_jin: Dictionary = _dict(factions_after[later_jin_index]) if later_jin_index >= 0 else {}
	if later_jin.is_empty():
		return {
			"regional_after": regional_after,
			"military_after": military_after,
			"report": {"faction_ai_actions": actions}
		}

	var hostility: float = _number(later_jin.get("hostility", 0))
	if hostility <= 0.0 and str(later_jin.get("attitude", "")).contains("敌"):
		hostility = 80.0
	var border_tension: float = _number(later_jin.get("border_tension", 0))
	if border_tension <= 0.0 and str(later_jin.get("territory", "")).contains("辽东"):
		border_tension = 65.0
	var broken_commitment_memory: Dictionary = _latest_faction_memory(later_jin, "broken_commitment")
	var memory_retaliation: bool = not broken_commitment_memory.is_empty()
	if memory_retaliation:
		hostility = maxf(hostility, 72.0 + absf(_number(broken_commitment_memory.get("trust_delta", 0))) * 0.3)
		border_tension = maxf(border_tension, 72.0)
	if hostility < 70.0 and border_tension < 70.0:
		return {
			"regional_after": regional_after,
			"military_after": military_after,
			"report": {"faction_ai_actions": actions}
		}

	var target_index: int = _ming_liaodong_region_index(regions_after)
	if target_index < 0:
		return {
			"regional_after": regional_after,
			"military_after": military_after,
			"report": {"faction_ai_actions": actions}
		}

	var military_strength: float = _number(later_jin.get("military_strength", 0))
	var pressure: float = clampf(
		maxf(0.0, hostility - 60.0) / 10.0
		+ maxf(0.0, border_tension - 60.0) / 12.0
		+ military_strength / 220000.0,
		1.0,
		8.0
	)
	var region: Dictionary = _dict(regions_after[target_index]).duplicate(true)
	var army_before: float = _number(region.get("army_pressure", 0))
	var unrest_before: float = _number(region.get("unrest", 0))
	var mood_before: float = _number(region.get("mood", 50))
	region["army_pressure"] = roundi(clampf(army_before + pressure, 0.0, 100.0))
	region["unrest"] = roundi(clampf(unrest_before + pressure * 0.45, 0.0, 100.0))
	region["mood"] = roundi(clampf(mood_before - pressure * 0.25, 0.0, 100.0))
	regions_after[target_index] = region

	var frontier_before: float = _number(military_after.get("liaodong_frontier_after", _variable_value(state, "辽东防线稳固度")))
	var frontier_delta: float = -clampf(pressure * 0.35, 0.5, 3.0)
	var frontier_after: float = clampf(frontier_before + frontier_delta, 0.0, 100.0)
	military_after["liaodong_frontier_after"] = frontier_after
	military_after["liaodong_frontier_delta"] = frontier_after - _number(military_after.get("liaodong_frontier_before", frontier_before))
	var alerts: Array = _array(military_after.get("military_alerts", [])).duplicate(true)
	alerts.append("后金压迫辽东防线")
	military_after["military_alerts"] = alerts

	var action: Dictionary = {
		"id": "faction-ai-%d-later-jin-pressure" % int(_number(state.get("turn"))),
		"kind": "pressure",
		"faction": "后金",
		"target_region": str(region.get("name", "辽东")),
		"pressure": pressure,
		"army_pressure_delta": _number(region.get("army_pressure", 0)) - army_before,
		"unrest_delta": _number(region.get("unrest", 0)) - unrest_before,
		"frontier_delta": frontier_delta,
		"reason": "敌意与边境紧张升高"
	}
	actions.append(action)
	if memory_retaliation:
		var retaliation_pressure: float = clampf(pressure * 0.45 + 1.0, 1.0, 5.0)
		later_jin = later_jin.duplicate(true)
		later_jin["hostility"] = roundi(clampf(_number(later_jin.get("hostility", hostility)) + 2.0, 0.0, 100.0))
		later_jin["border_tension"] = roundi(clampf(_number(later_jin.get("border_tension", border_tension)) + retaliation_pressure, 0.0, 100.0))
		factions_after[later_jin_index] = later_jin
		actions.append({
			"id": "faction-ai-%d-later-jin-diplomatic-retaliation" % int(_number(state.get("turn"))),
			"kind": "diplomatic_retaliation",
			"faction": "后金",
			"target_region": str(region.get("name", "辽东")),
			"pressure": retaliation_pressure,
			"border_tension_delta": retaliation_pressure,
			"source_memory": broken_commitment_memory.duplicate(true),
			"reason": "记恨毁约，借边事施压"
		})
		alerts.append("后金因毁约记忆施压")
		military_after["military_alerts"] = alerts

	if frontier_after <= 30.0 and pressure >= 4.0:
		var raid_pressure: float = clampf((30.0 - frontier_after) / 2.0 + pressure * 0.5, 2.0, 8.0)
		var raid_army_before: float = _number(region.get("army_pressure", 0))
		var raid_unrest_before: float = _number(region.get("unrest", 0))
		var raid_mood_before: float = _number(region.get("mood", 50))
		region["army_pressure"] = roundi(clampf(raid_army_before + raid_pressure * 0.65, 0.0, 100.0))
		region["unrest"] = roundi(clampf(raid_unrest_before + raid_pressure * 0.55, 0.0, 100.0))
		region["mood"] = roundi(clampf(raid_mood_before - raid_pressure * 0.45, 0.0, 100.0))
		regions_after[target_index] = region
		var raid_frontier_delta: float = -clampf(raid_pressure * 0.45, 1.0, 4.0)
		frontier_after = clampf(frontier_after + raid_frontier_delta, 0.0, 100.0)
		military_after["liaodong_frontier_after"] = frontier_after
		military_after["liaodong_frontier_delta"] = frontier_after - _number(military_after.get("liaodong_frontier_before", frontier_before))
		raid_money_delta = -roundf(raid_pressure * 20000.0)
		raid_grain_delta = -roundf(raid_pressure * 50000.0)
		actions.append({
			"id": "faction-ai-%d-later-jin-raid" % int(_number(state.get("turn"))),
			"kind": "raid",
			"faction": "后金",
			"target_region": str(region.get("name", "辽东")),
			"pressure": raid_pressure,
			"army_pressure_delta": _number(region.get("army_pressure", 0)) - raid_army_before,
			"unrest_delta": _number(region.get("unrest", 0)) - raid_unrest_before,
			"frontier_delta": raid_frontier_delta,
			"treasury_money_delta": raid_money_delta,
			"treasury_grain_delta": raid_grain_delta,
			"reason": "辽东防线低落，后金趁虚袭扰"
		})
		alerts.append("后金趁虚袭扰辽东")
		military_after["military_alerts"] = alerts

	var chahar_index: int = _faction_index_by_name(factions_after, "察哈尔")
	var chahar_region_index: int = _region_index_by_name(regions_after, "察哈尔")
	if chahar_index >= 0:
		var chahar: Dictionary = _dict(factions_after[chahar_index]).duplicate(true)
		var chahar_relation: float = _number(chahar.get("relation_to_player", 0))
		var chahar_strength: float = _number(chahar.get("military_strength", 0))
		var chahar_supported: bool = _has_active_diplomacy_commitment(state, "support_chahar", "察哈尔") or _number(chahar.get("ming_support", 0)) > 0.0
		if chahar_supported:
			var tension_before: float = _number(later_jin.get("border_tension", border_tension))
			var tension_delta: float = -clampf((chahar_relation - 45.0) / 4.0 + chahar_strength / 60000.0, 4.0, 12.0)
			later_jin = later_jin.duplicate(true)
			later_jin["border_tension"] = roundi(clampf(tension_before + tension_delta, 0.0, 100.0))
			factions_after[later_jin_index] = later_jin
			actions.append({
				"id": "faction-ai-%d-chahar-counterpressure" % int(_number(state.get("turn"))),
				"kind": "chahar_counterpressure",
				"faction": "察哈尔",
				"target_faction": "后金",
				"border_tension_delta": _number(later_jin.get("border_tension", tension_before)) - tension_before,
				"reason": "明廷援察哈尔牵制后金北翼"
			})
		else:
			var chahar_pressure: float = clampf(pressure * 0.55 + maxf(0.0, 100000.0 - chahar_strength) / 50000.0, 2.0, 7.0)
			var cohesion_before: float = _number(chahar.get("cohesion", 50))
			chahar["cohesion"] = roundi(clampf(cohesion_before - chahar_pressure, 0.0, 100.0))
			factions_after[chahar_index] = chahar
			var target_region_name: String = "察哈尔"
			var region_army_delta: float = 0.0
			if chahar_region_index >= 0:
				var chahar_region: Dictionary = _dict(regions_after[chahar_region_index]).duplicate(true)
				target_region_name = str(chahar_region.get("name", "察哈尔"))
				var chahar_army_before: float = _number(chahar_region.get("army_pressure", 0))
				var chahar_unrest_before: float = _number(chahar_region.get("unrest", 0))
				chahar_region["army_pressure"] = roundi(clampf(chahar_army_before + chahar_pressure, 0.0, 100.0))
				chahar_region["unrest"] = roundi(clampf(chahar_unrest_before + chahar_pressure * 0.5, 0.0, 100.0))
				chahar_region["mood"] = roundi(clampf(_number(chahar_region.get("mood", 50)) - chahar_pressure * 0.2, 0.0, 100.0))
				region_army_delta = _number(chahar_region.get("army_pressure", 0)) - chahar_army_before
				regions_after[chahar_region_index] = chahar_region
			actions.append({
				"id": "faction-ai-%d-later-jin-mongol-pressure" % int(_number(state.get("turn"))),
				"kind": "mongol_pressure",
				"faction": "后金",
				"target_faction": "察哈尔",
				"target_region": target_region_name,
				"pressure": chahar_pressure,
				"cohesion_delta": _number(chahar.get("cohesion", cohesion_before)) - cohesion_before,
				"army_pressure_delta": region_army_delta,
				"reason": "后金争夺蒙古诸部，压迫察哈尔"
			})
			var chahar_cohesion_after: float = _number(chahar.get("cohesion", cohesion_before))
			if chahar_relation <= 25.0 and chahar_cohesion_after <= 40.0:
				var relation_before: float = _number(chahar.get("relation_to_player", chahar_relation))
				var hostility_before: float = _number(chahar.get("hostility", 0))
				chahar["alignment"] = "后金倾向"
				chahar["relation_to_player"] = roundi(clampf(relation_before - 6.0, 0.0, 100.0))
				chahar["hostility"] = roundi(clampf(hostility_before + 5.0, 0.0, 100.0))
				chahar["attitude"] = "疏离"
				chahar["relations_text"] = "对大明关系 %d · 敌意 %d" % [
					int(chahar.get("relation_to_player", 0)),
					int(chahar.get("hostility", 0))
				]
				factions_after[chahar_index] = chahar
				actions.append({
					"id": "faction-ai-%d-chahar-alliance-shift" % int(_number(state.get("turn"))),
					"kind": "alliance_shift",
					"faction": "察哈尔",
					"target_faction": "察哈尔",
					"leaning_to": "后金",
					"relation_delta": _number(chahar.get("relation_to_player", relation_before)) - relation_before,
					"hostility_delta": _number(chahar.get("hostility", hostility_before)) - hostility_before,
					"reason": "后金压迫与明廷关系低落，察哈尔出现倒向后金之势"
				})
				alerts.append("察哈尔有倒向后金之势")
			alerts.append("后金压迫察哈尔")
			military_after["military_alerts"] = alerts

	regional_after["regions_after"] = regions_after
	military_after["factions_after"] = factions_after
	var report: Dictionary = {"faction_ai_actions": actions}
	if raid_money_delta != 0.0 or raid_grain_delta != 0.0:
		var total_money_delta: float = guoku_money_delta + raid_money_delta
		var total_grain_delta: float = guoku_grain_delta + raid_grain_delta
		report["guoku_money_delta"] = total_money_delta
		report["guoku_money_after"] = maxf(0.0, guoku_money_before + total_money_delta)
		report["guoku_money_shortfall"] = maxf(0.0, -(guoku_money_before + total_money_delta))
		report["guoku_grain_delta"] = total_grain_delta
		report["guoku_grain_after"] = maxf(0.0, guoku_grain_before + total_grain_delta)
		report["guoku_grain_shortfall"] = maxf(0.0, -(guoku_grain_before + total_grain_delta))
	return {
		"regional_after": regional_after,
		"military_after": military_after,
		"report": report
	}

func _faction_by_name(state: RefCounted, name: String) -> Dictionary:
	for raw in _array(state.get("factions")):
		var faction: Dictionary = _dict(raw)
		if str(faction.get("name", "")) == name:
			return faction
	return {}

func _has_active_diplomacy_commitment(state: RefCounted, commitment_id: String, target_faction: String) -> bool:
	for raw in _array(state.get("active_diplomacy_commitments")):
		var commitment: Dictionary = _dict(raw)
		if str(commitment.get("id", "")) != commitment_id:
			continue
		if str(commitment.get("target_faction", "")) != target_faction:
			continue
		if _number(commitment.get("remaining_months", 0)) > 0.0:
			return true
	return false

func _latest_faction_memory(faction: Dictionary, kind: String) -> Dictionary:
	var memory: Array = _array(faction.get("diplomacy_memory", []))
	for i in range(memory.size() - 1, -1, -1):
		var entry: Dictionary = _dict(memory[i])
		if str(entry.get("kind", "")) == kind:
			return entry
	return {}

func _faction_index_by_name(factions: Array, name: String) -> int:
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i])
		if str(faction.get("name", "")) == name:
			return i
	return -1

func _region_index_by_name(regions: Array, name: String) -> int:
	for i in range(regions.size()):
		var region: Dictionary = _dict(regions[i])
		if str(region.get("name", "")) == name:
			return i
	return -1

func _ming_liaodong_region_index(regions: Array) -> int:
	for name in ["辽东（明）", "辽东（明·关宁东江）"]:
		var exact: int = _region_index_by_name(regions, name)
		if exact >= 0:
			return exact
	for i in range(regions.size()):
		var region: Dictionary = _dict(regions[i])
		if not str(region.get("name", "")).contains("辽东"):
			continue
		if _region_belongs_to_ming(region):
			return i
	return _region_index_contains(regions, "辽东")

func _region_belongs_to_ming(region: Dictionary) -> bool:
	for key in ["owner", "owner_id", "controller", "controller_id", "factionName", "factionId", "dejureOwner"]:
		var value: String = str(region.get(key, "")).to_lower()
		if value.contains("明") or value.contains("ming"):
			return true
	return false

func _region_index_contains(regions: Array, text: String) -> int:
	for i in range(regions.size()):
		var region: Dictionary = _dict(regions[i])
		if str(region.get("name", "")).contains(text):
			return i
	return -1

func _preview_uprisings(state: RefCounted, regional: Dictionary, population: Dictionary, military: Dictionary) -> Dictionary:
	var factions_after: Array = _array(military.get("factions_after", state.get("factions"))).duplicate(true)
	var regions_after: Array = _array(regional.get("regions_after", state.get("map_regions"))).duplicate(true)
	var refugee_after: float = _number(population.get("refugee_after", _variable_value(state, "流民数量")))
	var minxin_after: float = _number(population.get("minxin_after", state.get("minxin")))
	var avg_unrest: float = _number(regional.get("avg_region_unrest", 50))
	var high_unrest_regions: int = int(_number(regional.get("high_unrest_regions", 0)))
	var risk: float = clampf(
		maxf(0.0, 35.0 - minxin_after) * 2.0
		+ refugee_after / 100000.0 * 0.6
		+ float(high_unrest_regions) * 8.0
		+ maxf(0.0, avg_unrest - 70.0) * 1.5,
		0.0,
		100.0
	)
	var can_spawn: bool = risk >= 70.0 and minxin_after < 35.0 and refugee_after >= 1500000.0 and high_unrest_regions >= 2
	var uprisings: Array = []
	if can_spawn:
		var candidate: Dictionary = _highest_unrest_region(regions_after)
		var candidate_id: String = str(candidate.get("id", candidate.get("name", "")))
		var uprising_id: String = "runtime-uprising-%s" % candidate_id
		if not _has_faction_id(factions_after, uprising_id):
			var army_size: float = clampf(refugee_after * 0.012 + _number(candidate.get("unrest", 80)) * 300.0, 3000.0, 90000.0)
			var region_name: String = str(candidate.get("name", "地方"))
			var uprising_name: String = "陕北起义军" if region_name.contains("陕西") else "%s民变军" % region_name
			var uprising: Dictionary = {
				"id": uprising_id,
				"name": uprising_name,
				"type": "起义军",
				"leader": "地方饥民首领",
				"leader_title": "渠帅",
				"strength": 8,
				"military_strength": army_size,
				"army": fmt_big(army_size, ""),
				"economy": 1,
				"capital": "%s·流动" % region_name,
				"territory": region_name,
				"attitude": "敌视",
				"goal": "裹挟流民，攻杀官吏，夺粮求生",
				"cohesion": 26,
				"military_cohesion": 34,
				"public_opinion": 42,
				"tech_level": 8,
				"culture_level": 20,
				"resources_text": "流民、饥民、逃卒",
				"relations_text": "明朝廷 -90",
				"description": "民心低落、流民激增与地方不稳叠加后形成的新起义势力。",
				"strategy": "先据乡里，再扰州县。"
			}
			factions_after.append(uprising)
			uprisings.append({
				"id": uprising_id,
				"name": uprising_name,
				"region_id": candidate_id,
				"region": region_name,
				"army": army_size,
				"risk": risk
			})
			for i in range(regions_after.size()):
				var region: Dictionary = _dict(regions_after[i]).duplicate(true)
				if str(region.get("id", region.get("name", ""))) != candidate_id:
					continue
				region["unrest"] = clampf(_number(region.get("unrest", 0)) + 4.0, 0.0, 100.0)
				region["mood"] = clampf(_number(region.get("mood", 0)) - 3.0, 0.0, 100.0)
				region["controller_id"] = uprising_id
				region["controller"] = uprising_name
				region["last_uprising_turn"] = int(_number(state.get("turn")))
				region["last_uprising"] = uprising_name
				regions_after[i] = region
				break

	return {
		"factions_after": factions_after,
		"regions_after": regions_after,
		"uprising_risk": risk,
		"uprising_created": uprisings.size() > 0,
		"uprisings": uprisings
	}

func _highest_unrest_region(regions: Array) -> Dictionary:
	var best: Dictionary = {}
	var best_score: float = -INF
	for raw_region in regions:
		var region: Dictionary = _dict(raw_region)
		var score: float = _number(region.get("unrest", 0)) * 1.5 - _number(region.get("mood", 50)) + _number(region.get("tax_pressure", 0)) * 0.25
		var name: String = str(region.get("name", ""))
		if name in ["陕西", "河南", "山西", "山东", "北直隶"]:
			score += 20.0
		if score > best_score:
			best_score = score
			best = region
	return best

func _has_faction_id(factions: Array, id: String) -> bool:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")) == id:
			return true
	return false

func _preview_regions(state: RefCounted) -> Dictionary:
	var source_regions: Array = _array(state.get("map_regions"))
	var regions_after: Array = []
	var total_weight: float = 0.0
	var mood_sum: float = 0.0
	var unrest_sum: float = 0.0
	var tax_sum: float = 0.0
	var army_sum: float = 0.0
	var high_unrest_count: int = 0
	var worsened_count: int = 0
	var notable_changes: Array = []

	for raw_region in source_regions:
		var region: Dictionary = _dict(raw_region).duplicate(true)
		var weight: float = maxf(1.0, _number(region.get("prefecture_count", 1)))
		var prosperity: float = _number(region.get("prosperity", 50))
		var mood_before: float = _number(region.get("mood", 50))
		var unrest_before: float = _number(region.get("unrest", 50))
		var tax_pressure: float = _number(region.get("tax_pressure", 0))
		var army_pressure: float = _number(region.get("army_pressure", 0))

		var mood_delta: float = clampf(
			(prosperity - 55.0) / 140.0
			- maxf(0.0, tax_pressure - 45.0) / 30.0
			- maxf(0.0, army_pressure - 40.0) / 40.0
			- maxf(0.0, unrest_before - 55.0) / 45.0,
			-3.0,
			2.0
		)
		var unrest_delta: float = clampf(
			maxf(0.0, tax_pressure - mood_before) / 35.0
			+ maxf(0.0, army_pressure - 45.0) / 45.0
			+ maxf(0.0, 50.0 - prosperity) / 30.0
			- maxf(0.0, mood_before - 55.0) / 35.0,
			-1.5,
			3.5
		)

		var mood_after: float = clampf(mood_before + mood_delta, 0.0, 100.0)
		var unrest_after: float = clampf(unrest_before + unrest_delta, 0.0, 100.0)
		region["mood"] = roundi(mood_after)
		region["unrest"] = roundi(unrest_after)
		region["mood_delta"] = mood_delta
		region["unrest_delta"] = unrest_delta
		regions_after.append(region)

		total_weight += weight
		mood_sum += mood_after * weight
		unrest_sum += unrest_after * weight
		tax_sum += tax_pressure * weight
		army_sum += army_pressure * weight
		if unrest_after >= 75.0:
			high_unrest_count += 1
		if unrest_delta > 0.15 or mood_delta < -0.15:
			worsened_count += 1
		if absf(mood_delta) >= 0.5 or absf(unrest_delta) >= 0.5:
			notable_changes.append({
				"name": str(region.get("name", "")),
				"mood_delta": mood_delta,
				"unrest_delta": unrest_delta,
				"mood_after": mood_after,
				"unrest_after": unrest_after
			})

	if total_weight <= 0.0:
		total_weight = 1.0

	return {
		"regions_after": regions_after,
		"avg_region_mood": mood_sum / total_weight,
		"avg_region_unrest": unrest_sum / total_weight,
		"avg_tax_pressure": tax_sum / total_weight,
		"avg_army_pressure": army_sum / total_weight,
		"high_unrest_regions": high_unrest_count,
		"worsened_regions": worsened_count,
		"region_changes": notable_changes
	}

func _preview_population(state: RefCounted, regional: Dictionary) -> Dictionary:
	var registered_before: float = _number(state.get("population_registered"))
	var hidden_before: float = _number(state.get("population_hidden"))
	var minxin_before: float = _number(state.get("minxin"))
	var avg_mood: float = _number(regional.get("avg_region_mood", 50))
	var avg_unrest: float = _number(regional.get("avg_region_unrest", 50))
	var avg_tax: float = _number(regional.get("avg_tax_pressure", 50))

	var hide_rate: float = clampf(
		maxf(0.0, avg_unrest - 58.0) * 0.00012
		+ maxf(0.0, 50.0 - minxin_before) * 0.00008
		+ maxf(0.0, avg_tax - 52.0) * 0.00006,
		0.0,
		0.003
	)
	var return_rate: float = clampf(
		maxf(0.0, minxin_before - 60.0) * 0.00004
		+ maxf(0.0, 48.0 - avg_unrest) * 0.00005,
		0.0,
		0.001
	)
	var hidden_delta: float = minf(registered_before, registered_before * hide_rate)
	var recovered_delta: float = minf(hidden_before, hidden_before * return_rate)
	var registered_after: float = maxf(0.0, registered_before - hidden_delta + recovered_delta)
	var hidden_after: float = maxf(0.0, hidden_before + hidden_delta - recovered_delta)
	var refugee_before: float = _variable_value(state, "流民数量")
	var refugee_delta: float = maxf(
		0.0,
		hidden_delta * 0.35
		+ maxf(0.0, avg_unrest - 70.0) * 6000.0
		+ float(int(regional.get("high_unrest_regions", 0))) * 2500.0
		- recovered_delta * 0.2
	)
	var minxin_delta: float = clampf(
		(avg_mood - 50.0) / 35.0
		- maxf(0.0, avg_unrest - 62.0) / 20.0
		- hide_rate * 40.0,
		-2.0,
		1.5
	)

	return {
		"population_registered_before": registered_before,
		"population_registered_after": registered_after,
		"population_registered_delta": registered_after - registered_before,
		"population_hidden_before": hidden_before,
		"population_hidden_after": hidden_after,
		"population_hidden_delta": hidden_after - hidden_before,
		"refugee_before": refugee_before,
		"refugee_after": maxf(0.0, refugee_before + refugee_delta),
		"refugee_delta": refugee_delta,
		"minxin_before": minxin_before,
		"minxin_after": clampf(minxin_before + minxin_delta, 0.0, 100.0),
		"minxin_delta": minxin_delta,
		"population_hide_rate": hide_rate,
		"population_return_rate": return_rate
	}

func _variable_value(state: RefCounted, name: String) -> float:
	if state.has_method("variable_value"):
		return _number(state.call("variable_value", name))
	return 0.0

static func fmt_big(value: float, suffix: String = "") -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿%s" % [value / 100000000.0, suffix]
	if abs_value >= 10000.0:
		return "%.1f万%s" % [value / 10000.0, suffix]
	return "%d%s" % [roundi(value), suffix]

static func _signed_big(value: float, suffix: String) -> String:
	if value > 0.0:
		return "+%s" % fmt_big(value, suffix)
	if value < 0.0:
		return "-%s" % fmt_big(absf(value), suffix)
	return "0%s" % suffix

static func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

static func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

static func _number(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	var parsed: float = str(value).to_float()
	return parsed if is_finite(parsed) else 0.0
