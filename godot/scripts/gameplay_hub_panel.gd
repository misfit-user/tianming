extends PanelContainer

class_name GameplayHubPanel

signal advance_month_requested
signal tab_requested(tab_name: String)
signal save_requested
signal load_requested

var date_label: Label
var resource_label: Label
var authority_label: Label
var agenda_box: VBoxContainer
var report_label: Label
var history_label: Label

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	add_child(margin)

	var root: VBoxContainer = VBoxContainer.new()
	root.add_theme_constant_override("separation", 12)
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_child(root)

	var title: Label = _make_label("御览总纲", 23, Color(0.88, 0.72, 0.42))
	root.add_child(title)

	date_label = _make_label("", 15, Color(0.90, 0.84, 0.70))
	resource_label = _make_label("", 14, Color(0.84, 0.78, 0.66))
	authority_label = _make_label("", 14, Color(0.84, 0.72, 0.60))
	root.add_child(date_label)
	root.add_child(resource_label)
	root.add_child(authority_label)

	var split: HBoxContainer = HBoxContainer.new()
	split.add_theme_constant_override("separation", 14)
	split.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(split)

	var agenda_panel: PanelContainer = PanelContainer.new()
	agenda_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	agenda_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.add_child(agenda_panel)

	var agenda_margin: MarginContainer = MarginContainer.new()
	agenda_margin.add_theme_constant_override("margin_left", 12)
	agenda_margin.add_theme_constant_override("margin_top", 10)
	agenda_margin.add_theme_constant_override("margin_right", 12)
	agenda_margin.add_theme_constant_override("margin_bottom", 10)
	agenda_panel.add_child(agenda_margin)

	var agenda_scroll: ScrollContainer = ScrollContainer.new()
	agenda_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	agenda_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	agenda_margin.add_child(agenda_scroll)

	agenda_box = VBoxContainer.new()
	agenda_box.add_theme_constant_override("separation", 7)
	agenda_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	agenda_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	agenda_scroll.add_child(agenda_box)

	var command_panel: PanelContainer = PanelContainer.new()
	command_panel.custom_minimum_size.x = 245
	command_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.add_child(command_panel)

	var command_margin: MarginContainer = MarginContainer.new()
	command_margin.add_theme_constant_override("margin_left", 12)
	command_margin.add_theme_constant_override("margin_top", 10)
	command_margin.add_theme_constant_override("margin_right", 12)
	command_margin.add_theme_constant_override("margin_bottom", 10)
	command_panel.add_child(command_margin)

	var command_box: VBoxContainer = VBoxContainer.new()
	command_box.add_theme_constant_override("separation", 8)
	command_margin.add_child(command_box)
	command_box.add_child(_make_label("政务入口", 16, Color(0.88, 0.72, 0.42)))
	_add_tab_button(command_box, "本月行动", "行动")
	_add_tab_button(command_box, "御前会议", "御前会议")
	_add_tab_button(command_box, "诏令", "诏令")
	_add_tab_button(command_box, "军令", "军令")
	_add_tab_button(command_box, "外交", "外交")
	_add_tab_button(command_box, "任免", "任免")
	_add_tab_button(command_box, "问对", "问对")
	_add_tab_button(command_box, "奏疏来文", "奏疏来文")
	_add_tab_button(command_box, "史官实录", "史官实录")
	_add_tab_button(command_box, "事件", "事件")
	_add_tab_button(command_box, "存档", "存档")
	_add_tab_button(command_box, "系统", "系统")
	_add_tab_button(command_box, "天下图", "天下图")

	var save_row: HBoxContainer = HBoxContainer.new()
	save_row.add_theme_constant_override("separation", 8)
	command_box.add_child(save_row)

	var save_button: Button = Button.new()
	save_button.text = "暂存"
	save_button.custom_minimum_size.y = 30
	save_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	save_button.pressed.connect(func() -> void:
		emit_signal("save_requested")
	)
	save_row.add_child(save_button)

	var load_button: Button = Button.new()
	load_button.text = "读取"
	load_button.custom_minimum_size.y = 30
	load_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	load_button.pressed.connect(func() -> void:
		emit_signal("load_requested")
	)
	save_row.add_child(load_button)

	var next_button: Button = Button.new()
	next_button.text = "下一月"
	next_button.custom_minimum_size.y = 34
	next_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	next_button.pressed.connect(func() -> void:
		emit_signal("advance_month_requested")
	)
	command_box.add_child(next_button)

	report_label = _make_label("", 13, Color(0.76, 0.68, 0.54))
	report_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.add_child(report_label)

	history_label = _make_label("", 12, Color(0.62, 0.58, 0.50))
	history_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.add_child(history_label)
	set_snapshot({})

func set_snapshot(snapshot: Dictionary) -> void:
	if date_label == null:
		return
	if snapshot.is_empty():
		date_label.text = "未载入"
		resource_label.text = ""
		authority_label.text = ""
		_set_agenda([])
		report_label.text = ""
		history_label.text = ""
		return

	date_label.text = "%s  ·  行动点 %d" % [
		str(snapshot.get("date", "")),
		int(_num(snapshot.get("action_points", 0)))
	]
	resource_label.text = "%s  ·  %s  ·  %s" % [
		str(snapshot.get("treasury", "")),
		str(snapshot.get("neitang", "")),
		str(snapshot.get("population", ""))
	]
	authority_label.text = str(snapshot.get("authority", ""))

	var agenda: Array = []
	var pending_events: int = int(_num(snapshot.get("pending_events_count", 0)))
	var pending_recommendations: int = int(_num(snapshot.get("pending_recommendations_count", 0)))
	var pending_communications: int = int(_num(snapshot.get("pending_communications_count", 0)))
	if pending_events > 0:
		agenda.append("待议事件 %d 件" % pending_events)
	if pending_recommendations > 0:
		agenda.append("议事建议 %d 条" % pending_recommendations)
	if pending_communications > 0:
		agenda.append("奏疏来文 %d 件" % pending_communications)
	agenda.append("本月可用行动点 %d" % int(_num(snapshot.get("action_points", 0))))
	for raw in _array(snapshot.get("urgent_alerts", [])):
		agenda.append(str(raw))
	if bool(snapshot.get("has_quick_save", false)):
		agenda.append("已有暂存可读取")
	_set_agenda(agenda)

	report_label.text = "月报：%s" % str(snapshot.get("last_report", ""))
	history_label.text = "近期：%s" % str(snapshot.get("history", "无"))

func visible_text() -> String:
	return "御览总纲\n%s\n%s\n%s\n%s\n%s\n%s" % [
		"" if date_label == null else date_label.text,
		"" if resource_label == null else resource_label.text,
		"" if authority_label == null else authority_label.text,
		_node_text(agenda_box),
		"" if report_label == null else report_label.text,
		"" if history_label == null else history_label.text
	]

func _set_agenda(items: Array) -> void:
	for child in agenda_box.get_children():
		child.queue_free()
	agenda_box.add_child(_make_label("本回合待办", 16, Color(0.88, 0.72, 0.42)))
	if items.is_empty():
		agenda_box.add_child(_make_label("暂无紧急奏报。", 14, Color(0.82, 0.78, 0.68)))
		return
	for raw in items:
		agenda_box.add_child(_make_label("· %s" % str(raw), 14, Color(0.86, 0.80, 0.68)))

func _node_text(node: Node) -> String:
	if node == null:
		return ""
	var lines: PackedStringArray = PackedStringArray()
	if node is Label:
		lines.append((node as Label).text)
	for child in node.get_children():
		var text: String = _node_text(child)
		if not text.is_empty():
			lines.append(text)
	return "\n".join(lines)

func _add_tab_button(parent: VBoxContainer, button_text: String, tab_name: String) -> void:
	var button: Button = Button.new()
	button.text = button_text
	button.custom_minimum_size.y = 30
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func() -> void:
		emit_signal("tab_requested", tab_name)
	)
	parent.add_child(button)

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

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []
