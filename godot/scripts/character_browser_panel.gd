extends MarginContainer

class_name CharacterBrowserPanel

const CharacterDetailPanelScript := preload("res://scripts/character_detail_panel.gd")

signal character_action_requested(character_id: String, action_id: String)

var character_list_box: VBoxContainer
var character_detail_panel: Control
var selected_character_button: Button
var selected_character_id: String = ""
var character_row_buttons: Dictionary = {}
var current_characters: Array = []
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
	scroll.custom_minimum_size.x = 520
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(scroll)

	character_list_box = VBoxContainer.new()
	character_list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	character_list_box.add_theme_constant_override("separation", 3)
	scroll.add_child(character_list_box)

	character_detail_panel = CharacterDetailPanelScript.new()
	character_detail_panel.connect("character_action_requested", Callable(self, "_on_detail_action_requested"))
	layout.add_child(character_detail_panel)
	set_data(current_characters, current_actions, current_history, current_action_points)

func set_data(characters: Array, actions: Array = [], history: Array = [], action_points: int = 0) -> void:
	current_characters = characters.duplicate(true)
	current_actions = actions.duplicate(true)
	current_history = history.duplicate(true)
	current_action_points = action_points
	if character_list_box == null:
		return
	if selected_character_id.is_empty() or _character_by_id(current_characters, selected_character_id).is_empty():
		selected_character_id = _first_character_id(current_characters)
	_refresh_rows()
	_update_detail()

func select_character(character_id: String) -> void:
	if _character_by_id(current_characters, character_id).is_empty():
		return
	selected_character_id = character_id
	_update_selected_button()
	_update_detail()

func visible_text() -> String:
	var selected: Dictionary = _character_by_id(current_characters, selected_character_id)
	return "人物\n%s\n%s\n%s" % [
		_character_list_text(),
		_character_detail_text(selected),
		"" if character_detail_panel == null else str(character_detail_panel.call("visible_text"))
	]

func _refresh_rows() -> void:
	_clear_box(character_list_box)
	character_row_buttons.clear()
	var header: HBoxContainer = HBoxContainer.new()
	header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_make_cell("人物", 98, true, true))
	header.add_child(_make_cell("身份", 188, true, true))
	header.add_child(_make_cell("党派", 78, false, true))
	header.add_child(_make_cell("忠", 38, false, true))
	header.add_child(_make_cell("智", 38, false, true))
	header.add_child(_make_cell("政", 38, false, true))
	header.add_child(_make_cell("武", 38, false, true))
	character_list_box.add_child(header)
	for raw in current_characters:
		var character: Dictionary = _dict(raw)
		var character_id: String = str(character.get("id", ""))
		if character_id.is_empty():
			continue
		var button: Button = _make_character_button(character)
		character_row_buttons[character_id] = button
		character_list_box.add_child(button)
		button.pressed.connect(func() -> void:
			select_character(character_id)
		)
	_update_selected_button()

func _make_character_button(character: Dictionary) -> Button:
	var button: Button = Button.new()
	button.flat = true
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.custom_minimum_size.y = 28
	button.tooltip_text = "%s · %s" % [str(character.get("name", "")), str(character.get("title", ""))]
	var row: HBoxContainer = HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 8
	row.offset_top = 2
	row.offset_right = -8
	row.offset_bottom = -2
	button.add_child(row)
	row.add_child(_make_cell(str(character.get("name", "")), 98, true, false))
	row.add_child(_make_cell(str(character.get("official_title", character.get("title", ""))), 188, true, false))
	row.add_child(_make_cell(str(character.get("party", "")), 78, false, false))
	row.add_child(_make_cell(str(character.get("loyalty", "")), 38, false, false))
	row.add_child(_make_cell(str(character.get("intelligence", "")), 38, false, false))
	row.add_child(_make_cell(str(character.get("administration", "")), 38, false, false))
	row.add_child(_make_cell(str(character.get("valor", "")), 38, false, false))
	return button

func _update_selected_button() -> void:
	selected_character_button = null
	for raw_id in character_row_buttons.keys():
		var character_id: String = str(raw_id)
		var button: Button = character_row_buttons.get(character_id, null) as Button
		if button == null:
			continue
		var selected: bool = character_id == selected_character_id
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if selected else Color.WHITE
		if selected:
			selected_character_button = button

func _update_detail() -> void:
	if character_detail_panel == null:
		return
	var character: Dictionary = _character_by_id(current_characters, selected_character_id)
	character_detail_panel.call("set_character", character)
	character_detail_panel.call("set_character_actions", current_actions, current_history, current_action_points)

func _on_detail_action_requested(character_id: String, action_id: String) -> void:
	emit_signal("character_action_requested", character_id, action_id)

func _character_detail_text(character: Dictionary) -> String:
	if character.is_empty():
		return "未选择人物"
	return "%s\n%s\n%s %s %s\n忠%d 智%d 政%d 武%d" % [
		str(character.get("name", "")),
		str(character.get("official_title", character.get("title", ""))),
		str(character.get("faction", "")),
		str(character.get("party", "")),
		str(character.get("location", "")),
		int(_num(character.get("loyalty", 0))),
		int(_num(character.get("intelligence", 0))),
		int(_num(character.get("administration", 0))),
		int(_num(character.get("valor", 0)))
	]

func _character_list_text() -> String:
	var lines: PackedStringArray = PackedStringArray()
	for raw in current_characters:
		var character: Dictionary = _dict(raw)
		lines.append("%s %s %s" % [
			str(character.get("name", "")),
			str(character.get("official_title", character.get("title", ""))),
			str(character.get("party", ""))
		])
	return "\n".join(lines)

func _make_cell(text: String, width: float, expand: bool, bold: bool) -> Label:
	var label: Label = Label.new()
	label.text = text
	label.custom_minimum_size.x = width
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL if expand else Control.SIZE_SHRINK_BEGIN
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.add_theme_font_size_override("font_size", 13)
	if bold:
		label.add_theme_color_override("font_color", Color(0.86, 0.70, 0.42))
	else:
		label.add_theme_color_override("font_color", Color(0.82, 0.78, 0.68))
	return label

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		child.queue_free()

func _first_character_id(characters: Array) -> String:
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var character_id: String = str(character.get("id", ""))
		if not character_id.is_empty():
			return character_id
	return ""

func _character_by_id(characters: Array, character_id: String) -> Dictionary:
	for raw in characters:
		var character: Dictionary = _dict(raw)
		if str(character.get("id", "")) == character_id:
			return character
	return {}

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()
