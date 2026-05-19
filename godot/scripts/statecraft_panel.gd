extends PanelContainer

class_name StatecraftPanel

signal statecraft_action_requested(variable_name: String, action_id: String)

var variables_box: VBoxContainer
var actions_box: VBoxContainer
var detail_label: Label
var history_label: Label
var selected_variable_name: String = ""
var current_variables: Array = []
var current_actions: Array = []
var current_history: Array = []
var current_action_points: int = 0

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
	left.custom_minimum_size.x = 430
	left.add_theme_constant_override("separation", 8)
	root.add_child(left)

	left.add_child(_make_label("国政态势", 20, Color(0.88, 0.72, 0.42)))
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(scroll)
	variables_box = VBoxContainer.new()
	variables_box.add_theme_constant_override("separation", 4)
	scroll.add_child(variables_box)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	root.add_child(right)

	detail_label = _make_label("选择变量后执行国政整饬。", 14, Color(0.86, 0.78, 0.64))
	right.add_child(detail_label)
	right.add_child(_make_label("整饬动作", 15, Color(0.88, 0.72, 0.42)))
	actions_box = VBoxContainer.new()
	actions_box.add_theme_constant_override("separation", 6)
	right.add_child(actions_box)
	history_label = _make_label("国政态势记录：无", 12, Color(0.68, 0.62, 0.50))
	history_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(history_label)
	set_data([], [], [], 0)

func set_data(variable_rows: Array, actions: Array, history: Array, action_points: int) -> void:
	current_variables = variable_rows.duplicate(true)
	current_actions = actions.duplicate(true)
	current_history = history.duplicate(true)
	current_action_points = action_points
	if variables_box == null:
		return
	if (selected_variable_name.is_empty() or _selected_variable().is_empty()) and current_variables.size() > 0:
		selected_variable_name = str(_dict(current_variables[0]).get("name", ""))
	elif current_variables.is_empty():
		selected_variable_name = ""
	_refresh_variables()
	_refresh_detail()

func select_variable(variable_name: String) -> void:
	if variable_name.is_empty():
		return
	selected_variable_name = variable_name
	if variables_box == null:
		return
	_refresh_variables()
	_refresh_detail()

func visible_text() -> String:
	return "国政态势\n%s\n%s" % [
		selected_variable_name,
		_history_text()
	]

func _refresh_variables() -> void:
	_clear_box(variables_box)
	for raw in current_variables:
		var variable: Dictionary = _dict(raw)
		var variable_name: String = str(variable.get("name", ""))
		if variable_name.is_empty():
			continue
		var button: Button = Button.new()
		button.text = "%s  %s\n%s · %s · %s" % [
			variable_name,
			str(variable.get("value", "")),
			str(variable.get("category", "未分")),
			str(variable.get("status", "平")),
			str(variable.get("desc", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if variable_name == selected_variable_name else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_variable_name = variable_name
			_refresh_variables()
			_refresh_detail()
		)
		variables_box.add_child(button)

func _refresh_detail() -> void:
	_clear_box(actions_box)
	var variable: Dictionary = _selected_variable()
	if variable.is_empty():
		detail_label.text = "选择变量后执行国政整饬。"
		history_label.text = "国政态势记录：无"
		return
	detail_label.text = "%s\n当前 %s · 范围 %s-%s · 类别 %s\n%s" % [
		str(variable.get("name", "")),
		str(variable.get("value", "")),
		str(variable.get("min", "")),
		str(variable.get("max", "")),
		str(variable.get("category", "")),
		str(variable.get("desc", ""))
	]
	var shown_actions: int = 0
	for raw in current_actions:
		var action: Dictionary = _dict(raw)
		var action_id: String = str(action.get("id", ""))
		var target_variable: String = str(action.get("target_variable", ""))
		if action_id.is_empty() or target_variable != selected_variable_name:
			continue
		shown_actions += 1
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
			emit_signal("statecraft_action_requested", selected_variable_name, action_id)
		)
		actions_box.add_child(button)
	if shown_actions == 0:
		var empty: Label = _make_label("此项暂无直接整饬动作。", 13, Color(0.68, 0.62, 0.50))
		actions_box.add_child(empty)
	history_label.text = _history_text()

func _selected_variable() -> Dictionary:
	for raw in current_variables:
		var variable: Dictionary = _dict(raw)
		if str(variable.get("name", "")) == selected_variable_name:
			return variable
	return {}

func _history_text() -> String:
	var lines: PackedStringArray = PackedStringArray()
	for raw in current_history:
		var record: Dictionary = _dict(raw)
		if not selected_variable_name.is_empty() and str(record.get("target_variable", "")) != selected_variable_name:
			continue
		lines.append("第%d回合 %s：%s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("action", "")),
			str(record.get("outcome", record.get("description", "")))
		])
	if lines.is_empty():
		return "国政态势记录：无"
	return "国政态势记录：\n%s" % "\n".join(lines)

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		box.remove_child(child)
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
