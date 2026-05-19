extends PanelContainer

class_name FactionDetailPanel

signal faction_action_requested(faction_id: String, action_id: String)

var title_label: Label
var type_label: Label
var stats_label: Label
var territory_label: Label
var relations_label: Label
var strategy_label: Label
var actions_box: VBoxContainer
var action_history_label: Label
var current_faction: Dictionary = {}
var current_actions: Array = []
var current_history: Array = []
var current_action_points: int = 0

func _ready() -> void:
	custom_minimum_size.x = 360
	size_flags_vertical = Control.SIZE_EXPAND_FILL

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	add_child(margin)

	var root: VBoxContainer = VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_child(root)

	title_label = _make_label(22, Color(0.88, 0.72, 0.42))
	root.add_child(title_label)

	type_label = _make_label(14, Color(0.74, 0.62, 0.42))
	root.add_child(type_label)

	var separator: HSeparator = HSeparator.new()
	root.add_child(separator)

	stats_label = _make_label(13, Color(0.90, 0.86, 0.75))
	root.add_child(stats_label)

	territory_label = _make_label(13, Color(0.82, 0.78, 0.68))
	root.add_child(territory_label)

	relations_label = _make_label(13, Color(0.84, 0.80, 0.70))
	root.add_child(relations_label)

	strategy_label = _make_label(13, Color(0.76, 0.70, 0.58))
	root.add_child(strategy_label)

	root.add_child(_make_heading("势力应对"))
	actions_box = VBoxContainer.new()
	actions_box.add_theme_constant_override("separation", 6)
	root.add_child(actions_box)

	action_history_label = _make_label(12, Color(0.68, 0.62, 0.50))
	action_history_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(action_history_label)

	set_faction({})
	set_faction_actions([], [], 0)

func set_faction(faction: Dictionary) -> void:
	current_faction = faction.duplicate(true)
	if title_label == null:
		return
	if current_faction.is_empty():
		title_label.text = "选择势力"
		type_label.text = ""
		stats_label.text = ""
		territory_label.text = ""
		relations_label.text = ""
		strategy_label.text = ""
		_refresh_actions()
		return

	title_label.text = str(current_faction.get("name", "未命名势力"))
	type_label.text = "%s · %s\n都城 %s · 首领 %s" % [
		str(current_faction.get("type", "")),
		str(current_faction.get("attitude", "")),
		str(current_faction.get("capital", "无")),
		str(current_faction.get("leader", ""))
	]
	stats_label.text = "国力 %d · 财力 %d · 军力 %s\n凝聚 %d · 军心 %d · 民意 %d\n科技 %d · 文化 %d" % [
		int(_num(current_faction.get("strength", 0))),
		int(_num(current_faction.get("economy", 0))),
		_fmt_big(_num(current_faction.get("military_strength", 0))),
		int(_num(current_faction.get("cohesion", 0))),
		int(_num(current_faction.get("military_cohesion", current_faction.get("cohesion", 0)))),
		int(_num(current_faction.get("public_opinion", 0))),
		int(_num(current_faction.get("tech_level", 0))),
		int(_num(current_faction.get("culture_level", 0)))
	]
	territory_label.text = "疆域：%s\n资源：%s" % [
		str(current_faction.get("territory", "")),
		str(current_faction.get("resources_text", ""))
	]
	relations_label.text = "关系：\n%s" % str(current_faction.get("relations_text", "无"))
	strategy_label.text = "目标：%s\n%s" % [
		str(current_faction.get("goal", "")),
		str(current_faction.get("description", current_faction.get("desc", "")))
	]
	_refresh_actions()

func set_faction_actions(actions: Array, history: Array, action_points: int) -> void:
	current_actions = actions.duplicate(true)
	current_history = history.duplicate(true)
	current_action_points = action_points
	if actions_box == null:
		return
	_refresh_actions()

func visible_text() -> String:
	var lines: PackedStringArray = PackedStringArray()
	lines.append("势力应对")
	lines.append(str(current_faction.get("name", "")))
	if type_label != null:
		lines.append(type_label.text)
	if stats_label != null:
		lines.append(stats_label.text)
	if territory_label != null:
		lines.append(territory_label.text)
	if relations_label != null:
		lines.append(relations_label.text)
	if strategy_label != null:
		lines.append(strategy_label.text)
	lines.append(_history_text())
	return "\n".join(lines)

func _refresh_actions() -> void:
	if actions_box == null:
		return
	_clear_box(actions_box)
	var faction_id: String = str(current_faction.get("id", ""))
	if current_faction.is_empty() or faction_id.is_empty():
		action_history_label.text = "请选择势力后应对。"
		return
	for raw in current_actions:
		var action: Dictionary = _dict(raw)
		var action_id: String = str(action.get("id", ""))
		if action_id.is_empty():
			continue
		var button: Button = Button.new()
		button.text = "%s · %s · 耗行动点 %d\n%s" % [
			str(action.get("name", action_id)),
			str(action.get("category", "")),
			int(_num(action.get("cost", 1))),
			str(action.get("desc", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.disabled = current_action_points < int(_num(action.get("cost", 1)))
		button.pressed.connect(func() -> void:
			emit_signal("faction_action_requested", faction_id, action_id)
		)
		actions_box.add_child(button)
	action_history_label.text = _history_text()

func _history_text() -> String:
	var faction_id: String = str(current_faction.get("id", ""))
	var lines: PackedStringArray = PackedStringArray()
	for raw in current_history:
		var record: Dictionary = _dict(raw)
		if not faction_id.is_empty() and str(record.get("target_faction_id", "")) != faction_id:
			continue
		lines.append("第%d回合 %s：%s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("action", "")),
			str(record.get("outcome", record.get("description", "")))
		])
	if lines.is_empty():
		return "势力应对记录：无"
	return "势力应对记录：\n%s" % "\n".join(lines)

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		box.remove_child(child)
		child.queue_free()

func _make_heading(text: String) -> Label:
	var label: Label = _make_label(15, Color(0.88, 0.72, 0.42))
	label.text = text
	return label

func _make_label(font_size: int, color: Color) -> Label:
	var label: Label = Label.new()
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fmt_big(value: float, suffix: String = "") -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿%s" % [value / 100000000.0, suffix]
	if abs_value >= 10000.0:
		return "%.1f万%s" % [value / 10000.0, suffix]
	return "%d%s" % [roundi(value), suffix]

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
