extends PanelContainer

class_name CharacterDetailPanel

signal character_action_requested(character_id: String, action_id: String)

var portrait_rect: TextureRect
var name_label: Label
var title_label: Label
var meta_label: Label
var stats_label: Label
var traits_label: Label
var bio_label: Label
var action_box: VBoxContainer
var action_history_label: Label
var current_character: Dictionary = {}
var current_actions: Array = []
var current_history: Array = []
var current_action_points: int = 0

func _ready() -> void:
	custom_minimum_size.x = 310
	size_flags_vertical = Control.SIZE_EXPAND_FILL

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	add_child(margin)

	var root: VBoxContainer = VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	margin.add_child(root)

	portrait_rect = TextureRect.new()
	portrait_rect.custom_minimum_size = Vector2(132, 176)
	portrait_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait_rect.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	root.add_child(portrait_rect)

	name_label = _make_label(22, Color(0.88, 0.72, 0.42), true)
	root.add_child(name_label)

	title_label = _make_label(14, Color(0.74, 0.62, 0.42), true)
	root.add_child(title_label)

	meta_label = _make_label(13, Color(0.84, 0.80, 0.70), true)
	root.add_child(meta_label)

	var separator: HSeparator = HSeparator.new()
	root.add_child(separator)

	stats_label = _make_label(13, Color(0.90, 0.86, 0.75), true)
	root.add_child(stats_label)

	traits_label = _make_label(13, Color(0.74, 0.68, 0.52), true)
	root.add_child(traits_label)

	bio_label = _make_label(13, Color(0.82, 0.78, 0.68), true)
	bio_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(bio_label)

	var action_separator: HSeparator = HSeparator.new()
	root.add_child(action_separator)

	root.add_child(_make_text_label("人物处置", 15, Color(0.88, 0.72, 0.42), false))
	action_box = VBoxContainer.new()
	action_box.add_theme_constant_override("separation", 5)
	root.add_child(action_box)

	action_history_label = _make_label(12, Color(0.70, 0.64, 0.52), true)
	root.add_child(action_history_label)

	set_character(current_character)
	set_character_actions(current_actions, current_history, current_action_points)

func set_character(character: Dictionary) -> void:
	current_character = character
	if name_label == null:
		return
	if character.is_empty():
		name_label.text = "选择人物"
		title_label.text = ""
		meta_label.text = ""
		stats_label.text = ""
		traits_label.text = ""
		bio_label.text = ""
		portrait_rect.texture = null
		_refresh_actions()
		return

	name_label.text = str(character.get("name", "未命名"))
	title_label.text = str(character.get("title", character.get("official_title", "")))
	meta_label.text = "%s · %s岁 · %s\n%s · %s · %s" % [
		str(character.get("gender", "")),
		str(character.get("age", "")),
		str(character.get("faction", "")),
		str(character.get("party", "无党")),
		str(character.get("social_class", "")),
		str(character.get("location", ""))
	]
	stats_label.text = "忠 %d · 志 %d · 智 %d · 政 %d\n勇 %d · 军 %d · 辩 %d · 望 %d\n仁 %d · 廉 %d" % [
		int(_num(character.get("loyalty", 0))),
		int(_num(character.get("ambition", 0))),
		int(_num(character.get("intelligence", 0))),
		int(_num(character.get("administration", 0))),
		int(_num(character.get("valor", 0))),
		int(_num(character.get("military", 0))),
		int(_num(character.get("diplomacy", 0))),
		int(_num(character.get("charisma", 0))),
		int(_num(character.get("benevolence", 0))),
		int(_num(character.get("integrity", 0)))
	]
	traits_label.text = "特质：%s" % str(character.get("traits_text", ""))
	bio_label.text = str(character.get("bio", character.get("personality", "")))
	_load_portrait(str(character.get("portrait_path", "")))
	_refresh_actions()

func set_character_actions(actions: Array, history: Array, action_points: int) -> void:
	current_actions = actions.duplicate(true)
	current_history = history.duplicate(true)
	current_action_points = action_points
	if action_box == null:
		return
	_refresh_actions()

func visible_text() -> String:
	return "人物处置\n%s\n%s" % [
		str(current_character.get("name", "")),
		_history_text()
	]

func _load_portrait(path: String) -> void:
	portrait_rect.texture = null
	if path.is_empty() or not FileAccess.file_exists(path):
		return
	var image: Image = Image.new()
	var err: Error = image.load(path)
	if err != OK:
		push_warning("Failed to load portrait %s error=%d" % [path, err])
		return
	portrait_rect.texture = ImageTexture.create_from_image(image)

func _refresh_actions() -> void:
	if action_box == null:
		return
	_clear_box(action_box)
	var character_id: String = str(current_character.get("id", ""))
	if current_character.is_empty() or character_id.is_empty():
		action_history_label.text = "请选择人物后处置。"
		return
	for raw in current_actions:
		var action: Dictionary = _dict(raw)
		var action_id: String = str(action.get("id", ""))
		if action_id.is_empty():
			continue
		var button: Button = Button.new()
		button.text = "%s · 耗行动点 %d\n%s" % [
			str(action.get("name", action_id)),
			int(_num(action.get("cost", 1))),
			str(action.get("description", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.disabled = current_action_points < int(_num(action.get("cost", 1)))
		button.pressed.connect(func() -> void:
			emit_signal("character_action_requested", character_id, action_id)
		)
		action_box.add_child(button)
	action_history_label.text = _history_text()

func _history_text() -> String:
	var character_id: String = str(current_character.get("id", ""))
	var lines: PackedStringArray = PackedStringArray()
	for raw in current_history:
		var record: Dictionary = _dict(raw)
		if not character_id.is_empty() and str(record.get("character_id", "")) != character_id:
			continue
		lines.append("第%d回合 %s：%s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("action", "")),
			str(record.get("outcome", record.get("description", "")))
		])
	if lines.is_empty():
		return "人物处置记录：无"
	return "人物处置记录：\n%s" % "\n".join(lines)

func _make_label(font_size: int, color: Color, should_wrap: bool) -> Label:
	var label: Label = Label.new()
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART if should_wrap else TextServer.AUTOWRAP_OFF
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func _make_text_label(text: String, font_size: int, color: Color, should_wrap: bool) -> Label:
	var label: Label = _make_label(font_size, color, should_wrap)
	label.text = text
	return label

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		child.queue_free()

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
