extends PanelContainer

class_name MonthlyReportPanel

var reports_box: VBoxContainer
var title_label: Label
var fiscal_label: Label
var military_label: Label
var authority_label: Label
var population_label: Label
var regional_label: Label
var alerts_label: Label
var current_reports: Array = []
var selected_report_turn: int = 0

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 14)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 14)
	add_child(margin)

	var root: HBoxContainer = HBoxContainer.new()
	root.add_theme_constant_override("separation", 12)
	margin.add_child(root)

	var left: VBoxContainer = VBoxContainer.new()
	left.custom_minimum_size.x = 310
	left.add_theme_constant_override("separation", 8)
	root.add_child(left)
	left.add_child(_make_text_label("月报簿", 20, Color(0.88, 0.72, 0.42)))
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(scroll)
	reports_box = VBoxContainer.new()
	reports_box.add_theme_constant_override("separation", 4)
	scroll.add_child(reports_box)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 9)
	root.add_child(right)

	title_label = _make_label(21, Color(0.88, 0.72, 0.42))
	right.add_child(title_label)
	fiscal_label = _make_label(14, Color(0.90, 0.86, 0.75))
	right.add_child(fiscal_label)
	military_label = _make_label(14, Color(0.86, 0.78, 0.66))
	right.add_child(military_label)
	authority_label = _make_label(14, Color(0.86, 0.70, 0.58))
	right.add_child(authority_label)
	population_label = _make_label(14, Color(0.82, 0.78, 0.68))
	right.add_child(population_label)
	regional_label = _make_label(14, Color(0.78, 0.72, 0.62))
	right.add_child(regional_label)
	alerts_label = _make_label(14, Color(0.95, 0.62, 0.42))
	alerts_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(alerts_label)
	set_reports([])

func set_report(report: Dictionary) -> void:
	if report.is_empty():
		set_reports([])
	else:
		set_reports([report])

func set_reports(reports: Array) -> void:
	current_reports = reports.duplicate(true)
	if title_label == null:
		return
	if current_reports.is_empty():
		selected_report_turn = 0
	elif selected_report_turn <= 0 or _report_by_turn(selected_report_turn).is_empty():
		selected_report_turn = _report_turn(_dict(current_reports[current_reports.size() - 1]), current_reports.size() - 1)
	_refresh_report_list()
	_show_report(_selected_report())

func select_report(turn: int) -> void:
	if _report_by_turn(turn).is_empty():
		return
	selected_report_turn = turn
	if title_label == null:
		return
	_refresh_report_list()
	_show_report(_selected_report())

func visible_text() -> String:
	var report: Dictionary = _selected_report()
	if report.is_empty():
		return "月报\n尚未载入回合报告。"
	return "%d年%d月\n%s\n%s\n%s" % [
		int(_num(report.get("year", 0))),
		int(_num(report.get("month", 0))),
		fiscal_label.text,
		military_label.text,
		alerts_label.text
	]

func _refresh_report_list() -> void:
	if reports_box == null:
		return
	_clear_box(reports_box)
	if current_reports.is_empty():
		reports_box.add_child(_make_text_label("暂无月报", 14, Color(0.72, 0.66, 0.52)))
		return
	for index in current_reports.size():
		var raw: Variant = current_reports[index]
		var report: Dictionary = _dict(raw)
		var turn: int = _report_turn(report, index)
		if turn <= 0:
			continue
		var status: String = "已结算" if bool(report.get("settled", false)) else "预计"
		var button: Button = Button.new()
		button.text = "第%d回合  %d年%d月\n%s · 国库银 %s · 事件 %d" % [
			turn,
			int(_num(report.get("year", 0))),
			int(_num(report.get("month", 0))),
			status,
			_signed_big(_num(report.get("guoku_money_delta", 0)), "两"),
			_array(report.get("events", [])).size()
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if turn == selected_report_turn else Color.WHITE
		button.pressed.connect(func() -> void:
			select_report(turn)
		)
		reports_box.add_child(button)

func _show_report(report: Dictionary) -> void:
	if report.is_empty():
		title_label.text = "月报"
		fiscal_label.text = "尚未载入回合报告。"
		military_label.text = ""
		authority_label.text = ""
		population_label.text = ""
		regional_label.text = ""
		alerts_label.text = ""
		return

	var status: String = "已结算" if bool(report.get("settled", false)) else "预计"
	title_label.text = "%d年%d月 · %s" % [
		int(_num(report.get("year", 0))),
		int(_num(report.get("month", 0))),
		status
	]
	fiscal_label.text = "财政：国库银 %s，国库粮 %s，内帑 %s。" % [
		_signed_big(_num(report.get("guoku_money_delta", 0)), "两"),
		_signed_big(_num(report.get("guoku_grain_delta", 0)), "石"),
		_signed_big(_num(report.get("neitang_money_delta", 0)), "两")
	]
	military_label.text = "军务：辽饷 %s，九边欠饷 %s，辽东防线 %s，明军军心 %s。" % [
		_signed_big(_num(report.get("liao_arrears_delta", 0)), "万两"),
		_signed_big(_num(report.get("jiubian_arrears_delta", 0)), "万两"),
		_signed_big(_num(report.get("liaodong_frontier_delta", 0)), ""),
		_signed_big(_num(report.get("ming_military_cohesion_delta", 0)), "")
	]
	authority_label.text = "权威：皇权 %s，皇威 %s。%s" % [
		_signed_big(_num(report.get("huangquan_delta", 0)), ""),
		_signed_big(_num(report.get("huangwei_delta", 0)), ""),
		"、".join(_string_array(report.get("authority_reasons", [])))
	]
	population_label.text = "民生：在籍 %s，隐匿 %s，流民 %s，民心 %s。" % [
		_signed_big(_num(report.get("population_registered_delta", 0)), "口"),
		_signed_big(_num(report.get("population_hidden_delta", 0)), "口"),
		_signed_big(_num(report.get("refugee_delta", 0)), "口"),
		_signed_big(_num(report.get("minxin_delta", 0)), "")
	]
	regional_label.text = "地方：平均民心 %d，平均不稳 %d，高不稳地块 %d，恶化地块 %d。" % [
		roundi(_num(report.get("avg_region_mood", 0))),
		roundi(_num(report.get("avg_region_unrest", 0))),
		int(_num(report.get("high_unrest_regions", 0))),
		int(_num(report.get("worsened_regions", 0)))
	]
	alerts_label.text = _alerts_text(report)

func _selected_report() -> Dictionary:
	return _report_by_turn(selected_report_turn)

func _report_by_turn(turn: int) -> Dictionary:
	for index in current_reports.size():
		var raw: Variant = current_reports[index]
		var report: Dictionary = _dict(raw)
		if _report_turn(report, index) == turn:
			return report
	return {}

func _report_turn(report: Dictionary, index: int) -> int:
	var explicit_turn: int = int(_num(report.get("turn", 0)))
	return explicit_turn if explicit_turn > 0 else index + 1

func _alerts_text(report: Dictionary) -> String:
	var lines: PackedStringArray = PackedStringArray()
	for raw_event in _array(report.get("events", [])):
		var event: Dictionary = _dict(raw_event)
		lines.append("事件待议：%s" % str(event.get("name", "未命名事件")))
	for raw_uprising in _array(report.get("uprisings", [])):
		var uprising: Dictionary = _dict(raw_uprising)
		lines.append("起义爆发：%s 于 %s 聚众 %s" % [
			str(uprising.get("name", "起义军")),
			str(uprising.get("region", "地方")),
			_fmt_big(_num(uprising.get("army", 0)), "人")
		])
	for raw_action in _array(report.get("faction_ai_actions", [])):
		var action: Dictionary = _dict(raw_action)
		lines.append(_faction_ai_action_text(action))
	for raw in _array(report.get("military_alerts", [])):
		lines.append("军务告警：%s" % str(raw))
	for raw_change in _array(report.get("region_changes", [])):
		var change: Dictionary = _dict(raw_change)
		lines.append("%s：民心 %s，不稳 %s" % [
			str(change.get("name", "地块")),
			_signed_big(_num(change.get("mood_delta", 0)), ""),
			_signed_big(_num(change.get("unrest_delta", 0)), "")
		])
	if lines.is_empty():
		return "暂无重大告警。"
	return "\n".join(lines)

func _faction_ai_action_text(action: Dictionary) -> String:
	var faction: String = str(action.get("faction", "外部势力"))
	var reason: String = str(action.get("reason", "")).strip_edges()
	var reason_text: String = "。%s" % reason if not reason.is_empty() else ""
	match str(action.get("kind", "")):
		"chahar_counterpressure":
			return "势力牵制：%s 牵制 %s，边境紧张 %s%s" % [
				faction,
				str(action.get("target_faction", "目标势力")),
				_signed_big(_num(action.get("border_tension_delta", 0)), ""),
				reason_text
			]
		"diplomatic_retaliation":
			return "毁约报复：%s 压迫 %s，边境紧张 %s%s" % [
				faction,
				str(action.get("target_region", action.get("target_faction", "边地"))),
				_signed_big(_num(action.get("border_tension_delta", 0)), ""),
				reason_text
			]
		"mongol_pressure":
			return "蒙古边务：%s 压迫 %s（%s），凝聚 %s，军压 %s%s" % [
				faction,
				str(action.get("target_faction", "目标势力")),
				str(action.get("target_region", "边地")),
				_signed_big(_num(action.get("cohesion_delta", 0)), ""),
				_signed_big(_num(action.get("army_pressure_delta", 0)), ""),
				reason_text
			]
		"alliance_shift":
			return "阵营转向：%s 倾向 %s，对明关系 %s，敌意 %s%s" % [
				faction,
				str(action.get("leaning_to", action.get("target_faction", "未知势力"))),
				_signed_big(_num(action.get("relation_delta", 0)), ""),
				_signed_big(_num(action.get("hostility_delta", 0)), ""),
				reason_text
			]
		"raid":
			return "边地袭扰：%s 袭扰 %s，国库银 %s，国库粮 %s，防线 %s%s" % [
				faction,
				str(action.get("target_region", "边地")),
				_signed_big(_num(action.get("treasury_money_delta", 0)), ""),
				_signed_big(_num(action.get("treasury_grain_delta", 0)), ""),
				_signed_big(_num(action.get("frontier_delta", 0)), ""),
				reason_text
			]
		_:
			return "势力施压：%s 压迫 %s，防线 %s%s" % [
				faction,
				str(action.get("target_region", action.get("target_faction", "边地"))),
				_signed_big(_num(action.get("frontier_delta", action.get("border_tension_delta", 0))), ""),
				reason_text
			]

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		box.remove_child(child)
		child.queue_free()

func _make_text_label(text: String, font_size: int, color: Color) -> Label:
	var label: Label = _make_label(font_size, color)
	label.text = text
	return label

func _make_label(font_size: int, color: Color) -> Label:
	var label: Label = Label.new()
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func _signed_big(value: float, suffix: String) -> String:
	if value > 0.0:
		return "+%s" % _fmt_big(value, suffix)
	if value < 0.0:
		return "-%s" % _fmt_big(absf(value), suffix)
	return "0%s" % suffix

func _fmt_big(value: float, suffix: String) -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿%s" % [value / 100000000.0, suffix]
	if abs_value >= 10000.0:
		return "%.1f万%s" % [value / 10000.0, suffix]
	return "%d%s" % [roundi(value), suffix]

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _string_array(value: Variant) -> PackedStringArray:
	var parts: PackedStringArray = PackedStringArray()
	for raw in _array(value):
		parts.append(str(raw))
	if parts.is_empty():
		parts.append("无")
	return parts
