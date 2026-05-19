extends PanelContainer

class_name CourtMeetingPanel

signal court_meeting_requested(topic_id: String, participant_ids: Array)
signal court_recommendation_requested(recommendation_id: String)

var topics_box: VBoxContainer
var recommendations_box: VBoxContainer
var participants_box: VBoxContainer
var detail_label: Label
var history_label: Label
var hold_button: Button
var selected_topic_id: String = ""
var selected_participant_ids: Array = []
var current_history: Array = []
var current_pending_recommendations: Array = []
var current_debate_entries: Array = []
var current_agenda_pressure: Array = []

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

	left.add_child(_make_label("御前会议", 21, Color(0.88, 0.72, 0.42)))
	topics_box = VBoxContainer.new()
	topics_box.add_theme_constant_override("separation", 6)
	left.add_child(topics_box)
	recommendations_box = VBoxContainer.new()
	recommendations_box.add_theme_constant_override("separation", 6)
	left.add_child(recommendations_box)
	history_label = _make_label("", 12, Color(0.62, 0.58, 0.50))
	left.add_child(history_label)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	root.add_child(right)

	detail_label = _make_label("选择议题和参议官员。", 14, Color(0.86, 0.78, 0.64))
	right.add_child(detail_label)

	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(scroll)
	participants_box = VBoxContainer.new()
	participants_box.add_theme_constant_override("separation", 5)
	scroll.add_child(participants_box)

	hold_button = Button.new()
	hold_button.text = "召开会议"
	hold_button.custom_minimum_size.y = 34
	hold_button.pressed.connect(_on_hold_pressed)
	right.add_child(hold_button)
	set_data([], [], [], 0, [], [])

func set_data(topics: Array, characters: Array, history: Array, action_points: int, pending_recommendations: Array = [], enacted_recommendations: Array = []) -> void:
	if topics_box == null:
		return
	current_history = history
	current_pending_recommendations = pending_recommendations
	current_debate_entries = _latest_debate_entries(history)
	current_agenda_pressure = _latest_agenda_pressure(history)
	if (selected_topic_id.is_empty() or _topic_by_id(topics, selected_topic_id).is_empty()) and not topics.is_empty():
		selected_topic_id = str(_dict(topics[0]).get("id", ""))
	elif topics.is_empty():
		selected_topic_id = ""
	selected_participant_ids = _live_participant_ids(selected_participant_ids, characters)
	if selected_participant_ids.is_empty():
		selected_participant_ids = _default_participant_ids(characters)
	_clear_box(topics_box)
	for raw in topics:
		var topic: Dictionary = _dict(raw)
		var topic_id: String = str(topic.get("id", ""))
		var button: Button = Button.new()
		button.text = "%s  [%s / %d点]\n%s" % [
			str(topic.get("name", "")),
			str(topic.get("domain", "")),
			max(1, int(_num(topic.get("cost", 1)))),
			str(topic.get("desc", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if topic_id == selected_topic_id else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_topic_id = topic_id
			set_data(topics, characters, history, action_points, pending_recommendations, enacted_recommendations)
		)
		topics_box.add_child(button)
	_update_participants(topics, characters, action_points)
	_update_recommendations(pending_recommendations, action_points)
	history_label.text = "%s\n%s\n%s\n%s" % [
		_history_text(history),
		_agenda_text(current_agenda_pressure),
		_debate_text(current_debate_entries),
		_enacted_text(enacted_recommendations)
	]

func visible_text() -> String:
	return "御前会议\n%s\n%s" % [
		"" if detail_label == null else detail_label.text,
		"" if history_label == null else history_label.text
	]

func _update_participants(topics: Array, characters: Array, action_points: int) -> void:
	_clear_box(participants_box)
	var topic: Dictionary = _topic_by_id(topics, selected_topic_id)
	var cost: int = max(1, int(_num(topic.get("cost", 1))))
	detail_label.text = "%s\n已选 %d 人，评分由能力与忠诚共同决定。" % [
		str(topic.get("name", "未选择议题")),
		selected_participant_ids.size()
	]
	hold_button.disabled = action_points < cost or selected_topic_id.is_empty() or selected_participant_ids.is_empty()

	for raw in _sorted_characters(characters, str(topic.get("domain", ""))):
		var character: Dictionary = _dict(raw)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		var selected: bool = id in selected_participant_ids
		var button: Button = Button.new()
		button.text = "%s  忠%d 智%d 政%d 军%d\n%s" % [
			str(character.get("name", "")),
			int(_num(character.get("loyalty", 0))),
			int(_num(character.get("intelligence", 0))),
			int(_num(character.get("administration", 0))),
			int(_num(character.get("military", 0))),
			str(character.get("official_title", character.get("title", "")))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if selected else Color.WHITE
		button.pressed.connect(func() -> void:
			_toggle_participant(id)
			set_data(topics, characters, current_history, action_points, current_pending_recommendations, [])
		)
		participants_box.add_child(button)

func _update_recommendations(pending_recommendations: Array, action_points: int) -> void:
	_clear_box(recommendations_box)
	if pending_recommendations.is_empty():
		recommendations_box.add_child(_make_label("待采纳建议：无", 13, Color(0.62, 0.58, 0.50)))
		return
	recommendations_box.add_child(_make_label("待采纳建议", 15, Color(0.88, 0.72, 0.42)))
	for raw in pending_recommendations:
		var recommendation: Dictionary = _dict(raw)
		var recommendation_id: String = str(recommendation.get("id", ""))
		if recommendation_id.is_empty():
			continue
		var cost: int = max(1, int(_num(recommendation.get("cost", 1))))
		var step: int = max(1, int(_num(recommendation.get("step", 1))))
		var group_text: String = str(recommendation.get("exclusive_group", ""))
		var button: Button = Button.new()
		button.text = "%s  [%s / %d点 / step %d]\n%s%s" % [
			str(recommendation.get("name", "")),
			str(recommendation.get("category", "")),
			cost,
			step,
			str(recommendation.get("desc", "")),
			(" / exclusive: %s" % group_text) if not group_text.is_empty() else ""
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.disabled = action_points < cost
		button.pressed.connect(func() -> void:
			emit_signal("court_recommendation_requested", recommendation_id)
		)
		recommendations_box.add_child(button)

func _on_hold_pressed() -> void:
	emit_signal("court_meeting_requested", selected_topic_id, selected_participant_ids.duplicate())

func _toggle_participant(id: String) -> void:
	if id in selected_participant_ids:
		selected_participant_ids.erase(id)
		return
	if selected_participant_ids.size() < 6:
		selected_participant_ids.append(id)

func _default_participant_ids(characters: Array) -> Array:
	var ids: Array = []
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var id: String = str(character.get("id", ""))
		if not id.is_empty():
			ids.append(id)
		if ids.size() >= 3:
			break
	return ids

func _live_participant_ids(participant_ids: Array, characters: Array) -> Array:
	var live_ids: Dictionary = {}
	for raw in characters:
		var character: Dictionary = _dict(raw)
		var id: String = str(character.get("id", ""))
		if not id.is_empty():
			live_ids[id] = true
	var result: Array = []
	for raw_id in participant_ids:
		var id: String = str(raw_id)
		if live_ids.has(id) and not id in result:
			result.append(id)
	return result

func _sorted_characters(characters: Array, domain: String) -> Array:
	var rows: Array = characters.duplicate(true)
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return _candidate_score(a, domain) > _candidate_score(b, domain)
	)
	return rows

func _candidate_score(character: Dictionary, domain: String) -> float:
	var loyalty: float = _num(character.get("loyalty", 50))
	match domain:
		"finance":
			return _num(character.get("administration", 0)) * 0.5 + _num(character.get("management", 0)) * 0.2 + _num(character.get("intelligence", 0)) * 0.2 + loyalty * 0.1
		"frontier":
			return _num(character.get("military", 0)) * 0.45 + _num(character.get("valor", 0)) * 0.2 + _num(character.get("intelligence", 0)) * 0.2 + loyalty * 0.15
		_:
			return _num(character.get("intelligence", 0)) * 0.35 + _num(character.get("administration", 0)) * 0.35 + loyalty * 0.3

func _topic_by_id(topics: Array, topic_id: String) -> Dictionary:
	for raw in topics:
		var topic: Dictionary = _dict(raw)
		if str(topic.get("id", "")) == topic_id:
			return topic
	return {}

func _history_text(history: Array) -> String:
	if history.is_empty():
		return "近期会议：无"
	var names: PackedStringArray = PackedStringArray()
	for raw in history:
		var record: Dictionary = _dict(raw)
		names.append("T%d %s / %.0f / %s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("name", "")),
			_num(record.get("score", 0)),
			str(record.get("outcome", ""))
		])
	return "近期会议：%s" % "；".join(names)

func _latest_debate_entries(history: Array) -> Array:
	if history.is_empty():
		return []
	var last: Dictionary = _dict(history[history.size() - 1])
	return _array(last.get("debate_entries", []))

func _latest_agenda_pressure(history: Array) -> Array:
	if history.is_empty():
		return []
	var last: Dictionary = _dict(history[history.size() - 1])
	return _array(last.get("agenda_pressure", []))

func _agenda_text(rows: Array) -> String:
	if rows.is_empty():
		return "Agenda: none"
	var parts: PackedStringArray = PackedStringArray()
	for raw in rows:
		var pressure: Dictionary = _dict(raw)
		var target_region: String = str(pressure.get("target_region", ""))
		var summary: String = str(pressure.get("summary", ""))
		if not target_region.is_empty():
			parts.append("%s %.0f" % [target_region, _num(pressure.get("severity", 0))])
		elif not summary.is_empty():
			parts.append(summary)
	return "Agenda: %s" % "; ".join(parts)

func _debate_text(entries: Array) -> String:
	if entries.is_empty():
		return "Debate: none"
	var parts: PackedStringArray = PackedStringArray()
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		var speaker_name: String = str(entry.get("name", "official"))
		var stance: String = str(entry.get("stance", "caution"))
		var party: String = str(entry.get("party", ""))
		var suffix: String = " (%s)" % party if not party.is_empty() else ""
		var relationship_text: String = _relationship_text(_dict(entry.get("relationship_context", {})))
		parts.append("%s %s%s%s" % [speaker_name, stance, suffix, relationship_text])
	return "Debate: %s" % "; ".join(parts)

func _relationship_text(context: Dictionary) -> String:
	if context.is_empty():
		return ""
	var kind: String = str(context.get("kind", ""))
	var target_name: String = str(context.get("target_name", ""))
	if kind.is_empty() or target_name.is_empty():
		return ""
	return " %s:%s" % [kind, target_name]

func _enacted_text(history: Array) -> String:
	if history.is_empty():
		return "已采纳建议：无"
	var names: PackedStringArray = PackedStringArray()
	for raw in history:
		var record: Dictionary = _dict(raw)
		names.append("T%d %s" % [
			int(_num(record.get("enacted_turn", record.get("turn", 0)))),
			str(record.get("name", ""))
		])
	return "已采纳建议：%s" % "；".join(names)

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

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []
