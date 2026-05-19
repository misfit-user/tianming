extends PanelContainer

class_name AudiencePanel

signal audience_requested(character_id: String, topic_id: String)

var points_label: Label
var character_select: OptionButton
var topic_select: OptionButton
var topic_label: Label
var history_label: Label
var last_characters: Array = []
var last_topics: Array = []
var last_history: Array = []
var selected_character_id: String = ""
var selected_topic_id: String = ""

func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 14)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 14)
	add_child(margin)

	var root: VBoxContainer = VBoxContainer.new()
	root.add_theme_constant_override("separation", 9)
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_child(root)

	root.add_child(_make_label("问对", 21, Color(0.88, 0.72, 0.42)))
	points_label = _make_label("", 13, Color(0.72, 0.64, 0.50))
	root.add_child(points_label)

	var controls: HBoxContainer = HBoxContainer.new()
	controls.add_theme_constant_override("separation", 8)
	root.add_child(controls)

	character_select = OptionButton.new()
	character_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	character_select.item_selected.connect(func(idx: int) -> void:
		selected_character_id = str(character_select.get_item_metadata(idx))
	)
	controls.add_child(character_select)

	topic_select = OptionButton.new()
	topic_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topic_select.item_selected.connect(func(idx: int) -> void:
		selected_topic_id = str(topic_select.get_item_metadata(idx))
		_refresh_topic_label()
	)
	controls.add_child(topic_select)

	var button: Button = Button.new()
	button.text = "召见"
	button.custom_minimum_size.x = 84
	button.pressed.connect(_request_audience)
	controls.add_child(button)

	topic_label = _make_label("", 13, Color(0.84, 0.78, 0.66))
	root.add_child(topic_label)

	history_label = _make_label("", 13, Color(0.88, 0.84, 0.74))
	history_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(history_label)
	set_data([], [], [], 0)

func set_data(characters: Array, topics: Array, history: Array, action_points: int) -> void:
	last_characters = characters.duplicate(true)
	last_topics = topics.duplicate(true)
	last_history = history.duplicate(true)
	if selected_character_id.is_empty() or _character_by_id(selected_character_id).is_empty():
		selected_character_id = _first_character_id()
	if selected_topic_id.is_empty() or _topic_by_id(selected_topic_id).is_empty():
		selected_topic_id = _first_topic_id()
	if points_label == null:
		return
	points_label.text = "行动点：%d · 选择人物与问对主题" % action_points
	_fill_characters()
	_fill_topics()
	_refresh_topic_label()
	history_label.text = _history_text()

func visible_text() -> String:
	return "问对\n%s\n%s" % [topic_label.text, _history_text()]

func _fill_characters() -> void:
	character_select.clear()
	for i in range(last_characters.size()):
		var character: Dictionary = _dict(last_characters[i])
		var character_id: String = str(character.get("id", ""))
		character_select.add_item("%s · %s" % [
			str(character.get("name", "")),
			str(character.get("official_title", character.get("title", "")))
		])
		character_select.set_item_metadata(i, character_id)
		if character_id == selected_character_id:
			character_select.select(i)

func _fill_topics() -> void:
	topic_select.clear()
	for i in range(last_topics.size()):
		var topic: Dictionary = _dict(last_topics[i])
		var topic_id: String = str(topic.get("id", ""))
		topic_select.add_item("%s · %s" % [str(topic.get("name", "")), str(topic.get("domain", ""))])
		topic_select.set_item_metadata(i, topic_id)
		if topic_id == selected_topic_id:
			topic_select.select(i)

func _refresh_topic_label() -> void:
	if topic_label == null:
		return
	var idx: int = topic_select.selected
	if idx < 0 or idx >= last_topics.size():
		topic_label.text = "暂无问对主题。"
		return
	var topic: Dictionary = _dict(last_topics[idx])
	topic_label.text = "%s：%s" % [
		str(topic.get("name", "")),
		str(topic.get("desc", ""))
	]

func _request_audience() -> void:
	var character_id: String = str(character_select.get_selected_metadata())
	var topic_id: String = str(topic_select.get_selected_metadata())
	if character_id.is_empty() or topic_id.is_empty():
		return
	selected_character_id = character_id
	selected_topic_id = topic_id
	emit_signal("audience_requested", character_id, topic_id)

func _first_character_id() -> String:
	for raw in last_characters:
		var character: Dictionary = _dict(raw)
		var id: String = str(character.get("id", ""))
		if not id.is_empty():
			return id
	return ""

func _first_topic_id() -> String:
	for raw in last_topics:
		var topic: Dictionary = _dict(raw)
		var id: String = str(topic.get("id", ""))
		if not id.is_empty():
			return id
	return ""

func _character_by_id(character_id: String) -> Dictionary:
	for raw in last_characters:
		var character: Dictionary = _dict(raw)
		if str(character.get("id", "")) == character_id:
			return character
	return {}

func _topic_by_id(topic_id: String) -> Dictionary:
	for raw in last_topics:
		var topic: Dictionary = _dict(raw)
		if str(topic.get("id", "")) == topic_id:
			return topic
	return {}

func _history_text() -> String:
	if last_history.is_empty():
		return "近期问对：无"
	var lines: PackedStringArray = PackedStringArray()
	for raw in last_history:
		var record: Dictionary = _dict(raw)
		lines.append("第%d回合 %s问对《%s》：%s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("character_name", "")),
			str(record.get("topic", "")),
			str(record.get("response", ""))
		])
	return "\n".join(lines)

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
