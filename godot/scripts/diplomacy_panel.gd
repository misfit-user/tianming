extends PanelContainer

class_name DiplomacyPanel

signal diplomacy_requested(action_id: String, target_faction_id: String)
signal diplomacy_commitment_renew_requested(commitment_id: String, target_faction_id: String)
signal diplomacy_commitment_break_requested(commitment_id: String, target_faction_id: String)

var actions_box: VBoxContainer
var factions_box: VBoxContainer
var commitments_box: VBoxContainer
var detail_label: Label
var history_label: Label
var issue_button: Button
var selected_action_id: String = ""
var selected_faction_id: String = ""
var current_history: Array = []
var current_commitments: Array = []

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
	left.custom_minimum_size.x = 320
	left.add_theme_constant_override("separation", 8)
	root.add_child(left)

	left.add_child(_make_label("外交", 21, Color(0.88, 0.72, 0.42)))
	actions_box = VBoxContainer.new()
	actions_box.add_theme_constant_override("separation", 6)
	left.add_child(actions_box)
	history_label = _make_label("", 12, Color(0.62, 0.58, 0.50))
	left.add_child(history_label)
	commitments_box = VBoxContainer.new()
	commitments_box.add_theme_constant_override("separation", 5)
	left.add_child(commitments_box)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	root.add_child(right)

	detail_label = _make_label("选择外交方式与目标势力。", 14, Color(0.86, 0.78, 0.64))
	right.add_child(detail_label)

	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(scroll)
	factions_box = VBoxContainer.new()
	factions_box.add_theme_constant_override("separation", 5)
	scroll.add_child(factions_box)

	issue_button = Button.new()
	issue_button.text = "遣使交涉"
	issue_button.custom_minimum_size.y = 34
	issue_button.pressed.connect(_on_issue_pressed)
	right.add_child(issue_button)
	set_data([], [], [], 0, [])

func set_data(actions: Array, factions: Array, history: Array, action_points: int, commitments: Array = []) -> void:
	if actions_box == null:
		return
	current_history = history
	current_commitments = commitments
	if (selected_action_id.is_empty() or _action_by_id(actions, selected_action_id).is_empty()) and not actions.is_empty():
		selected_action_id = str(_dict(actions[0]).get("id", ""))
	elif actions.is_empty():
		selected_action_id = ""
	if selected_faction_id.is_empty() or _faction_by_id(factions, selected_faction_id).is_empty():
		selected_faction_id = _first_faction_id(factions)
	_clear_box(actions_box)
	for raw in actions:
		var action: Dictionary = _dict(raw)
		var action_id: String = str(action.get("id", ""))
		var button: Button = Button.new()
		button.text = "%s  [%s / %d点]\n%s" % [
			str(action.get("name", "")),
			str(action.get("category", "")),
			max(1, int(_num(action.get("cost", 1)))),
			str(action.get("desc", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if action_id == selected_action_id else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_action_id = action_id
			set_data(actions, factions, history, action_points, current_commitments)
		)
		actions_box.add_child(button)
	_update_factions(actions, factions, action_points)
	history_label.text = _history_text(history)
	_update_commitments(commitments, action_points)

func visible_text() -> String:
	return "鸿胪外务\n%s\n%s" % [
		"" if detail_label == null else detail_label.text,
		"" if history_label == null else history_label.text
	]

func _update_factions(actions: Array, factions: Array, action_points: int) -> void:
	_clear_box(factions_box)
	var action: Dictionary = _action_by_id(actions, selected_action_id)
	var cost: int = max(1, int(_num(action.get("cost", 1))))
	detail_label.text = "%s\n选择一个目标势力。" % str(action.get("name", "未选择外交方式"))
	issue_button.disabled = action_points < cost or selected_faction_id.is_empty()

	for raw in factions:
		var faction: Dictionary = _dict(raw)
		var faction_id: String = str(faction.get("id", ""))
		if faction_id.is_empty() or str(faction.get("name", "")).contains("明"):
			continue
		var relation: int = int(_num(faction.get("relation_to_player", 0)))
		var hostility: int = int(_num(faction.get("hostility", 0)))
		var button: Button = Button.new()
		button.text = "%s  %s\n关系%d 敌意%d  %s" % [
			str(faction.get("name", "")),
			str(faction.get("attitude", "")),
			relation,
			hostility,
			str(faction.get("capital", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if faction_id == selected_faction_id else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_faction_id = faction_id
			set_data(actions, factions, current_history, action_points, current_commitments)
		)
		factions_box.add_child(button)

func _on_issue_pressed() -> void:
	emit_signal("diplomacy_requested", selected_action_id, selected_faction_id)

func _update_commitments(commitments: Array, action_points: int) -> void:
	_clear_box(commitments_box)
	commitments_box.add_child(_make_label("外交承诺", 15, Color(0.88, 0.72, 0.42)))
	if commitments.is_empty():
		commitments_box.add_child(_make_label("暂无进行中的承诺", 12, Color(0.62, 0.58, 0.50)))
		return
	for raw in commitments:
		var commitment: Dictionary = _dict(raw)
		var commitment_id: String = str(commitment.get("id", ""))
		var target_id: String = str(commitment.get("target_faction_id", ""))
		var row: HBoxContainer = HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		commitments_box.add_child(row)

		var label: Label = _make_label("%s / %s · %d月" % [
			str(commitment.get("name", commitment_id)),
			str(commitment.get("target_faction", target_id)),
			int(_num(commitment.get("remaining_months", 0)))
		], 12, Color(0.74, 0.70, 0.60))
		row.add_child(label)

		var renew_button: Button = Button.new()
		renew_button.text = "续"
		renew_button.tooltip_text = "花费行动点续约此外交承诺"
		renew_button.disabled = action_points <= 0
		renew_button.custom_minimum_size = Vector2(42, 28)
		renew_button.pressed.connect(func() -> void:
			emit_signal("diplomacy_commitment_renew_requested", commitment_id, target_id)
		)
		row.add_child(renew_button)

		var break_button: Button = Button.new()
		break_button.text = "毁"
		break_button.tooltip_text = "毁约会降低目标势力信任并提高敌意"
		break_button.custom_minimum_size = Vector2(42, 28)
		break_button.pressed.connect(func() -> void:
			emit_signal("diplomacy_commitment_break_requested", commitment_id, target_id)
		)
		row.add_child(break_button)

func _action_by_id(actions: Array, action_id: String) -> Dictionary:
	for raw in actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return action
	return {}

func _first_faction_id(factions: Array) -> String:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		var id: String = str(faction.get("id", ""))
		if not id.is_empty() and not str(faction.get("name", "")).contains("明"):
			return id
	return ""

func _faction_by_id(factions: Array, faction_id: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")) == faction_id:
			return faction
	return {}

func _history_text(history: Array) -> String:
	if history.is_empty():
		return "近期外交：无"
	var names: PackedStringArray = PackedStringArray()
	for raw in history:
		var record: Dictionary = _dict(raw)
		var parts: PackedStringArray = PackedStringArray()
		parts.append("T%d %s / %s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("name", "")),
			str(record.get("target_faction", ""))
		])
		if record.has("cost"):
			parts.append("耗行动点 %d" % int(_num(record.get("cost", 0))))
		var applied_text: String = _effect_text(_dict(record.get("applied", {})))
		if not applied_text.is_empty():
			parts.append("朝廷 %s" % applied_text)
		var faction_text: String = _effect_text(_dict(record.get("faction_applied", {})))
		if not faction_text.is_empty():
			parts.append("势力 %s" % faction_text)
		if record.has("remaining_months"):
			parts.append("余期 %d月" % int(_num(record.get("remaining_months", 0))))
		names.append(" / ".join(parts))
	return "近期外交：%s" % "；".join(names)

func _effect_text(values: Dictionary) -> String:
	if values.is_empty():
		return ""
	var parts: PackedStringArray = PackedStringArray()
	for key in values.keys():
		parts.append("%s %s" % [_effect_label(str(key)), _signed_big(_num(values.get(key, 0)))])
	return "，".join(parts)

func _effect_label(key: String) -> String:
	match key:
		"treasury_money", "帑廪":
			return "国库银"
		"inner_treasury_money":
			return "内帑"
		"treasury_grain":
			return "国库粮"
		"huangquan", "imperial_authority":
			return "皇权"
		"huangwei", "imperial_prestige":
			return "皇威"
		"relation_to_player":
			return "对明关系"
		"hostility":
			return "敌意"
		"border_tension":
			return "边境紧张"
		"trade_access":
			return "互市"
		"military_strength":
			return "军力"
		"cohesion":
			return "凝聚"
		"ming_support":
			return "明援"
		"tribute_pressure":
			return "朝贡压力"
	return key

func _signed_big(value: float) -> String:
	if value > 0.0:
		return "+%s" % _fmt_big(value)
	if value < 0.0:
		return "-%s" % _fmt_big(absf(value))
	return "0"

func _fmt_big(value: float) -> String:
	if value >= 100000000.0:
		return "%.1f亿" % (value / 100000000.0)
	if value >= 10000.0:
		return "%.1f万" % (value / 10000.0)
	if is_equal_approx(value, roundf(value)):
		return "%d" % roundi(value)
	return "%.1f" % value

func _clear_box(box: BoxContainer) -> void:
	if box == null:
		return
	for child in box.get_children():
		child.queue_free()

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var label: Label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
