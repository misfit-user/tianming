extends PanelContainer

class_name CommunicationPanel

signal communication_process_requested(communication_id: String, action: String)

var count_label: Label
var inbox_box: VBoxContainer
var archive_label: Label
var last_items: Array = []
var last_archive: Array = []

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

	var title: Label = _make_label("奏疏来文", 21, Color(0.88, 0.72, 0.42))
	root.add_child(title)
	count_label = _make_label("", 13, Color(0.72, 0.64, 0.50))
	root.add_child(count_label)

	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(scroll)

	inbox_box = VBoxContainer.new()
	inbox_box.add_theme_constant_override("separation", 8)
	inbox_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(inbox_box)

	archive_label = _make_label("", 12, Color(0.62, 0.58, 0.50))
	root.add_child(archive_label)
	set_data([], [])

func set_data(items: Array, archive: Array) -> void:
	last_items = items.duplicate(true)
	last_archive = archive.duplicate(true)
	if count_label == null:
		return
	count_label.text = "待阅 %d 件 · 已归档 %d 件" % [last_items.size(), last_archive.size()]
	_clear_items()
	if last_items.is_empty():
		inbox_box.add_child(_make_label("暂无奏疏来文。", 14, Color(0.82, 0.78, 0.68)))
	else:
		inbox_box.add_child(_make_label("奏疏", 16, Color(0.86, 0.72, 0.46)))
		_add_kind_items("memorial")
		inbox_box.add_child(_make_label("来文", 16, Color(0.66, 0.76, 0.88)))
		_add_kind_items("letter")
	archive_label.text = _archive_text()

func visible_text() -> String:
	var lines: PackedStringArray = PackedStringArray()
	lines.append("奏疏")
	for raw in last_items:
		var item: Dictionary = _dict(raw)
		if str(item.get("kind", "")) == "memorial":
			lines.append(_item_text(item))
	lines.append("来文")
	for raw in last_items:
		var item: Dictionary = _dict(raw)
		if str(item.get("kind", "")) == "letter":
			lines.append(_item_text(item))
	lines.append(_archive_text())
	return "\n".join(lines)

func _add_kind_items(kind: String) -> void:
	var added: bool = false
	for raw in last_items:
		var item: Dictionary = _dict(raw)
		if str(item.get("kind", "")) != kind:
			continue
		_add_item(item)
		added = true
	if not added:
		inbox_box.add_child(_make_label("无", 13, Color(0.62, 0.58, 0.50)))

func _add_item(item: Dictionary) -> void:
	var panel: PanelContainer = PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inbox_box.add_child(panel)

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 8)
	panel.add_child(margin)

	var box: VBoxContainer = VBoxContainer.new()
	box.add_theme_constant_override("separation", 5)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.add_child(box)

	box.add_child(_make_label(_item_heading(item), 15, Color(0.90, 0.78, 0.52)))
	box.add_child(_make_label(str(item.get("body", "")), 13, Color(0.88, 0.84, 0.74)))

	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	_add_action_button(row, "纳入议事", str(item.get("id", "")), "recommend")
	_add_action_button(row, "存档", str(item.get("id", "")), "archive")

func _add_action_button(parent: HBoxContainer, label: String, communication_id: String, action: String) -> void:
	var button: Button = Button.new()
	button.text = label
	button.custom_minimum_size.y = 28
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func() -> void:
		emit_signal("communication_process_requested", communication_id, action)
	)
	parent.add_child(button)

func _item_heading(item: Dictionary) -> String:
	return "第%d回合 · %s · %s · 优先 %d" % [
		int(_num(item.get("turn", 0))),
		str(item.get("sender", "")),
		str(item.get("title", "")),
		int(_num(item.get("priority", 0)))
	]

func _item_text(item: Dictionary) -> String:
	return "%s\n%s" % [_item_heading(item), str(item.get("body", ""))]

func _archive_text() -> String:
	if last_archive.is_empty():
		return "已归档：无"
	var lines: PackedStringArray = PackedStringArray()
	lines.append("已归档：")
	for raw in last_archive:
		var item: Dictionary = _dict(raw)
		lines.append(_archived_item_text(item))
	return "\n".join(lines)

func _archived_item_text(item: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	parts.append(_item_heading(item))
	var body: String = str(item.get("body", "")).strip_edges()
	if not body.is_empty():
		parts.append(body)
	var status: String = _processed_status_text(item)
	if not status.is_empty():
		parts.append(status)
	return "\n".join(parts)

func _processed_status_text(item: Dictionary) -> String:
	var action: String = str(item.get("processed_action", "")).strip_edges()
	var status: String = str(item.get("status", "")).strip_edges()
	if action == "recommend" or status == "recommended":
		var recommendation_id: String = str(item.get("created_recommendation_id", "")).strip_edges()
		return "处理：已纳入议事%s" % ("（%s）" % recommendation_id if not recommendation_id.is_empty() else "")
	if action == "archive" or status == "archived":
		return "处理：已存档"
	return ""

func _clear_items() -> void:
	if inbox_box == null:
		return
	for child in inbox_box.get_children():
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
