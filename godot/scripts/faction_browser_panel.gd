extends MarginContainer

class_name FactionBrowserPanel

const FactionDetailPanelScript := preload("res://scripts/faction_detail_panel.gd")

signal faction_action_requested(faction_id: String, action_id: String)

var faction_list_box: VBoxContainer
var faction_detail_panel: Control
var selected_faction_button: Button
var selected_faction_id: String = ""
var faction_row_buttons: Dictionary = {}
var current_factions: Array = []
var current_actions: Array = []
var current_history: Array = []
var current_action_points: int = 0

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("margin_left", 8)
	add_theme_constant_override("margin_top", 8)
	add_theme_constant_override("margin_right", 8)
	add_theme_constant_override("margin_bottom", 8)

	var layout: HBoxContainer = HBoxContainer.new()
	layout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	layout.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_theme_constant_override("separation", 12)
	add_child(layout)

	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.custom_minimum_size.x = 500
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(scroll)

	faction_list_box = VBoxContainer.new()
	faction_list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	faction_list_box.add_theme_constant_override("separation", 3)
	scroll.add_child(faction_list_box)

	faction_detail_panel = FactionDetailPanelScript.new()
	faction_detail_panel.connect("faction_action_requested", Callable(self, "_on_detail_action_requested"))
	layout.add_child(faction_detail_panel)
	set_data(current_factions, current_actions, current_history, current_action_points)

func set_data(factions: Array, actions: Array = [], history: Array = [], action_points: int = 0) -> void:
	current_factions = factions.duplicate(true)
	current_actions = actions.duplicate(true)
	current_history = history.duplicate(true)
	current_action_points = action_points
	if faction_list_box == null:
		return
	if selected_faction_id.is_empty() or _faction_by_id(current_factions, selected_faction_id).is_empty():
		selected_faction_id = _first_faction_id(current_factions)
	_refresh_rows()
	_update_detail()

func select_faction(faction_id: String) -> void:
	if _faction_by_id(current_factions, faction_id).is_empty():
		return
	selected_faction_id = faction_id
	_update_selected_button()
	_update_detail()

func visible_text() -> String:
	var selected: Dictionary = _faction_by_id(current_factions, selected_faction_id)
	return "势力\n%s\n%s\n%s" % [
		_faction_list_text(),
		_faction_detail_text(selected),
		"" if faction_detail_panel == null else str(faction_detail_panel.call("visible_text"))
	]

func _refresh_rows() -> void:
	_clear_box(faction_list_box)
	faction_row_buttons.clear()
	var header: HBoxContainer = HBoxContainer.new()
	header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_make_cell("势力", 118, true, true))
	header.add_child(_make_cell("首领", 92, true, true))
	header.add_child(_make_cell("态度", 58, false, true))
	header.add_child(_make_cell("势", 36, false, true))
	header.add_child(_make_cell("军", 70, false, true))
	header.add_child(_make_cell("财", 36, false, true))
	faction_list_box.add_child(header)
	for raw in current_factions:
		var faction: Dictionary = _dict(raw)
		var faction_id: String = str(faction.get("id", ""))
		if faction_id.is_empty():
			continue
		var button: Button = _make_faction_button(faction)
		faction_row_buttons[faction_id] = button
		faction_list_box.add_child(button)
		button.pressed.connect(func() -> void:
			select_faction(faction_id)
		)
	_update_selected_button()

func _make_faction_button(faction: Dictionary) -> Button:
	var button: Button = Button.new()
	button.flat = true
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.custom_minimum_size.y = 28
	button.tooltip_text = "%s · %s" % [str(faction.get("name", "")), str(faction.get("capital", ""))]
	var row: HBoxContainer = HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 8
	row.offset_top = 2
	row.offset_right = -8
	row.offset_bottom = -2
	button.add_child(row)
	row.add_child(_make_cell(str(faction.get("name", "")), 118, true, false))
	row.add_child(_make_cell(str(faction.get("leader", "")), 92, true, false))
	row.add_child(_make_cell(str(faction.get("attitude", "")), 58, false, false))
	row.add_child(_make_cell(str(faction.get("strength", "")), 36, false, false))
	row.add_child(_make_cell(str(faction.get("army", "")), 70, false, false))
	row.add_child(_make_cell(str(faction.get("economy", "")), 36, false, false))
	return button

func _update_selected_button() -> void:
	selected_faction_button = null
	for raw_id in faction_row_buttons.keys():
		var faction_id: String = str(raw_id)
		var button: Button = faction_row_buttons.get(faction_id, null) as Button
		if button == null:
			continue
		var selected: bool = faction_id == selected_faction_id
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if selected else Color.WHITE
		if selected:
			selected_faction_button = button

func _update_detail() -> void:
	if faction_detail_panel == null:
		return
	var faction: Dictionary = _faction_by_id(current_factions, selected_faction_id)
	faction_detail_panel.call("set_faction", faction)
	faction_detail_panel.call("set_faction_actions", current_actions, current_history, current_action_points)

func _on_detail_action_requested(faction_id: String, action_id: String) -> void:
	emit_signal("faction_action_requested", faction_id, action_id)

func _faction_detail_text(faction: Dictionary) -> String:
	if faction.is_empty():
		return "未选择势力"
	return "%s\n%s · %s\n都城 %s · 首领 %s\n国力%d 财力%d 军力%s" % [
		str(faction.get("name", "")),
		str(faction.get("type", "")),
		str(faction.get("attitude", "")),
		str(faction.get("capital", "")),
		str(faction.get("leader", "")),
		int(_num(faction.get("strength", 0))),
		int(_num(faction.get("economy", 0))),
		str(faction.get("army", ""))
	]

func _faction_list_text() -> String:
	var lines: PackedStringArray = PackedStringArray()
	for raw in current_factions:
		var faction: Dictionary = _dict(raw)
		lines.append("%s %s %s" % [
			str(faction.get("name", "")),
			str(faction.get("leader", "")),
			str(faction.get("attitude", ""))
		])
	return "\n".join(lines)

func _make_cell(text: String, width: float, expand: bool, bold: bool) -> Label:
	var label: Label = Label.new()
	label.text = text
	label.custom_minimum_size.x = width
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL if expand else Control.SIZE_SHRINK_BEGIN
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", Color(0.86, 0.70, 0.42) if bold else Color(0.82, 0.78, 0.68))
	return label

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		child.queue_free()

func _first_faction_id(factions: Array) -> String:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		var faction_id: String = str(faction.get("id", ""))
		if not faction_id.is_empty():
			return faction_id
	return ""

func _faction_by_id(factions: Array, faction_id: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")) == faction_id:
			return faction
	return {}

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()
