extends PanelContainer

class_name EventQueuePanel

signal event_resolve_requested(event_id: String, choice_index: int)

var events_box: VBoxContainer
var title_label: Label
var meta_label: Label
var body_label: Label
var effect_label: Label
var choices_box: VBoxContainer
var history_label: Label
var selected_event_id: String = ""
var current_event_queue: Array = []
var current_resolved_events: Array = []

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
	left.custom_minimum_size.x = 360
	left.add_theme_constant_override("separation", 8)
	root.add_child(left)
	left.add_child(_make_text_label("待议事件", 20, Color(0.88, 0.72, 0.42)))
	var event_scroll: ScrollContainer = ScrollContainer.new()
	event_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	event_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(event_scroll)
	events_box = VBoxContainer.new()
	events_box.add_theme_constant_override("separation", 4)
	event_scroll.add_child(events_box)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 9)
	root.add_child(right)

	title_label = _make_label(21, Color(0.88, 0.72, 0.42))
	right.add_child(title_label)
	meta_label = _make_label(13, Color(0.72, 0.62, 0.44))
	right.add_child(meta_label)
	body_label = _make_label(14, Color(0.90, 0.86, 0.75))
	body_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(body_label)
	effect_label = _make_label(13, Color(0.82, 0.76, 0.64))
	right.add_child(effect_label)
	choices_box = VBoxContainer.new()
	choices_box.add_theme_constant_override("separation", 6)
	right.add_child(choices_box)
	history_label = _make_label(12, Color(0.62, 0.58, 0.50))
	right.add_child(history_label)
	set_events([], [])

func set_events(event_queue: Array, resolved_events: Array) -> void:
	current_event_queue = event_queue.duplicate(true)
	current_resolved_events = resolved_events.duplicate(true)
	if title_label == null:
		return
	if current_event_queue.is_empty():
		selected_event_id = ""
	elif selected_event_id.is_empty() or _event_by_id(selected_event_id).is_empty():
		selected_event_id = str(_dict(current_event_queue[0]).get("id", ""))
	_refresh_event_list()
	_refresh_detail()

func select_event(event_id: String) -> void:
	if event_id.is_empty() or _event_by_id(event_id).is_empty():
		return
	selected_event_id = event_id
	if title_label == null:
		return
	_refresh_event_list()
	_refresh_detail()

func visible_text() -> String:
	var event: Dictionary = _selected_event()
	return "事件\n%s\n%s\n%s" % [
		str(event.get("name", "")),
		str(event.get("narrative", event.get("description", ""))),
		_history_text()
	]

func _refresh_event_list() -> void:
	if events_box == null:
		return
	_clear_box(events_box)
	if current_event_queue.is_empty():
		events_box.add_child(_make_text_label("暂无待议事件", 14, Color(0.72, 0.66, 0.52)))
		return
	for raw in current_event_queue:
		var event: Dictionary = _dict(raw)
		var event_id: String = str(event.get("id", ""))
		if event_id.is_empty():
			continue
		var button: Button = Button.new()
		button.text = "%s\n%s · %s · 第%d回合" % [
			str(event.get("name", "未命名事件")),
			str(event.get("source", "")),
			str(event.get("type", "")),
			int(_num(event.get("queued_turn", 0)))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if event_id == selected_event_id else Color.WHITE
		button.pressed.connect(func() -> void:
			select_event(event_id)
		)
		events_box.add_child(button)

func _refresh_detail() -> void:
	if choices_box == null:
		return
	_clear_box(choices_box)
	var event: Dictionary = _selected_event()
	if event.is_empty():
		title_label.text = "事件"
		meta_label.text = "暂无待议事件"
		body_label.text = "推进月份后，到期的天象、政务、军务、灾异等事件会进入这里。"
		effect_label.text = ""
		history_label.text = _history_text()
		return

	var event_id: String = str(event.get("id", ""))
	title_label.text = str(event.get("name", "未命名事件"))
	meta_label.text = "%s · %s · 第%d回合入队" % [
		str(event.get("source", "")),
		str(event.get("type", "")),
		int(_num(event.get("queued_turn", 0)))
	]
	body_label.text = str(event.get("narrative", event.get("description", "")))
	effect_label.text = "效果：%s" % str(event.get("effect", ""))

	var choices: Array = _array(event.get("choices", []))
	if choices.is_empty():
		_add_choice_button("处理事件", event_id, -1)
	else:
		for i in range(choices.size()):
			var choice: Dictionary = _dict(choices[i])
			var text: String = str(choice.get("text", "选项%d" % (i + 1)))
			var effect_text: String = str(choice.get("effect", ""))
			_add_choice_button("%s  %s" % [text, effect_text], event_id, i)
	history_label.text = _history_text()

func _add_choice_button(text: String, event_id: String, choice_index: int) -> void:
	var button: Button = Button.new()
	button.text = text
	button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func() -> void:
		emit_signal("event_resolve_requested", event_id, choice_index)
	)
	choices_box.add_child(button)

func _selected_event() -> Dictionary:
	return _event_by_id(selected_event_id)

func _event_by_id(event_id: String) -> Dictionary:
	for raw in current_event_queue:
		var event: Dictionary = _dict(raw)
		if str(event.get("id", "")) == event_id:
			return event
	return {}

func _clear_box(box: BoxContainer) -> void:
	for child in box.get_children():
		box.remove_child(child)
		child.queue_free()

func _history_text() -> String:
	if current_resolved_events.is_empty():
		return "已处理：无"
	var lines: PackedStringArray = PackedStringArray()
	lines.append("已处理：")
	for raw in current_resolved_events:
		var event: Dictionary = _dict(raw)
		lines.append(_resolved_event_text(event))
	return "\n".join(lines)

func _resolved_event_text(event: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	parts.append("第%d回合 · %s" % [
		int(_num(event.get("resolved_turn", event.get("queued_turn", 0)))),
		str(event.get("name", event.get("id", "已处理事件")))
	])
	var choice_text: String = str(event.get("choice_text", "")).strip_edges()
	if not choice_text.is_empty():
		parts.append("选择：%s" % choice_text)
	var effect_text: String = _applied_effects_text(_dict(event.get("applied_effects", {})))
	if not effect_text.is_empty():
		parts.append("影响：%s" % effect_text)
	return "\n".join(parts)

func _applied_effects_text(applied_effects: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for key in applied_effects.keys():
		var value: Variant = applied_effects.get(key)
		if typeof(value) == TYPE_DICTIONARY:
			_append_effect_dict(parts, _dict(value))
		elif typeof(value) == TYPE_ARRAY:
			_append_effect_array(parts, _array(value))
		else:
			parts.append("%s %s" % [str(key), str(value)])
	return "，".join(parts)

func _append_effect_dict(parts: PackedStringArray, values: Dictionary) -> void:
	for key in values.keys():
		parts.append("%s %s" % [str(key), _signed_num(_num(values.get(key, 0)))])

func _append_effect_array(parts: PackedStringArray, values: Array) -> void:
	for raw in values:
		var row: Dictionary = _dict(raw)
		if row.is_empty():
			continue
		var subject: String = str(row.get("name", row.get("id", row.get("region", row.get("faction", "")))))
		var deltas: PackedStringArray = PackedStringArray()
		for key in row.keys():
			if ["id", "name", "region", "faction"].has(str(key)):
				continue
			deltas.append("%s %s" % [str(key), _signed_num(_num(row.get(key, 0)))])
		if deltas.is_empty():
			parts.append(subject)
		else:
			parts.append("%s（%s）" % [subject, "，".join(deltas)])

func _signed_num(value: float) -> String:
	if value > 0.0:
		return "+%s" % _format_num(value)
	if value < 0.0:
		return "-%s" % _format_num(absf(value))
	return "0"

func _format_num(value: float) -> String:
	if is_equal_approx(value, roundf(value)):
		return "%d" % roundi(value)
	return "%.1f" % value

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

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []
