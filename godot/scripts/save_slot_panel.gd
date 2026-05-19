extends PanelContainer

class_name SaveSlotPanel

signal save_slot_requested(slot_id: String)
signal load_slot_requested(slot_id: String)
signal delete_slot_requested(slot_id: String)

var slots_box: VBoxContainer
var status_label: Label
var slot_metadata_by_id: Dictionary = {}
var pending_overwrite_slot_id: String = ""

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
	root.add_theme_constant_override("separation", 10)
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_child(root)

	root.add_child(_make_label("存档", 21, Color(0.88, 0.72, 0.42)))
	status_label = _make_label("选择槽位保存或读取当前进度。", 13, Color(0.78, 0.70, 0.58))
	root.add_child(status_label)

	slots_box = VBoxContainer.new()
	slots_box.add_theme_constant_override("separation", 8)
	slots_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slots_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(slots_box)
	set_slots([])

func set_slots(slots: Array) -> void:
	if slots_box == null:
		return
	pending_overwrite_slot_id = ""
	slot_metadata_by_id.clear()
	for child in slots_box.get_children():
		child.queue_free()
	if slots.is_empty():
		pending_overwrite_slot_id = ""
		slots_box.add_child(_make_label("暂无槽位。", 14, Color(0.82, 0.78, 0.68)))
		return
	for raw in slots:
		var metadata: Dictionary = _dict(raw)
		var slot_id: String = str(metadata.get("slot_id", "quick"))
		slot_metadata_by_id[slot_id] = metadata
		_add_slot_row(metadata)

func set_status(text: String) -> void:
	if status_label != null:
		status_label.text = text

func visible_text() -> String:
	return "存档\n%s\n%s" % [
		"" if status_label == null else status_label.text,
		_node_text(slots_box)
	]

func request_save_slot(slot_id: String) -> Dictionary:
	var metadata: Dictionary = _dict(slot_metadata_by_id.get(slot_id, {}))
	if bool(metadata.get("exists", false)) and pending_overwrite_slot_id != slot_id:
		pending_overwrite_slot_id = slot_id
		set_status("槽位已有存档，再次点击保存将覆盖。")
		return {
			"ok": false,
			"needs_confirm": true,
			"slot_id": slot_id
		}
	pending_overwrite_slot_id = ""
	emit_signal("save_slot_requested", slot_id)
	return {
		"ok": true,
		"emitted": true,
		"slot_id": slot_id
	}

func request_load_slot(slot_id: String) -> Dictionary:
	pending_overwrite_slot_id = ""
	var metadata: Dictionary = _dict(slot_metadata_by_id.get(slot_id, {}))
	if not bool(metadata.get("exists", false)):
		var missing: String = "妲戒綅鏆傛棤瀛樟。"
		set_status(missing)
		return {
			"ok": false,
			"missing": true,
			"error": missing,
			"slot_id": slot_id
		}
	if bool(metadata.get("exists", false)) and not bool(metadata.get("compatible", true)):
		var warning: String = str(metadata.get("version_warning", "存档版本不兼容"))
		set_status(warning)
		return {
			"ok": false,
			"incompatible": true,
			"error": warning,
			"slot_id": slot_id
		}
	emit_signal("load_slot_requested", slot_id)
	return {
		"ok": true,
		"emitted": true,
		"slot_id": slot_id
	}

func request_delete_slot(slot_id: String) -> Dictionary:
	pending_overwrite_slot_id = ""
	var metadata: Dictionary = _dict(slot_metadata_by_id.get(slot_id, {}))
	if not bool(metadata.get("exists", false)):
		var missing: String = "妲戒綅鏆傛棤瀛樟。"
		set_status(missing)
		return {
			"ok": false,
			"missing": true,
			"error": missing,
			"slot_id": slot_id
		}
	emit_signal("delete_slot_requested", slot_id)
	return {
		"ok": true,
		"emitted": true,
		"slot_id": slot_id
	}

func _add_slot_row(metadata: Dictionary) -> void:
	var slot_id: String = str(metadata.get("slot_id", "quick"))
	var panel: PanelContainer = PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slots_box.add_child(panel)

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 8)
	panel.add_child(margin)

	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.add_child(row)

	var info: VBoxContainer = VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	info.add_child(_make_label(_slot_title(slot_id), 16, Color(0.90, 0.82, 0.64)))
	info.add_child(_make_label(_slot_desc(metadata), 13, Color(0.78, 0.72, 0.62)))
	var summary_text: String = str(metadata.get("summary_text", ""))
	if not summary_text.is_empty():
		info.add_child(_make_label(summary_text, 12, Color(0.66, 0.74, 0.62)))

	var save_button: Button = _make_button("保存")
	save_button.pressed.connect(func() -> void:
		request_save_slot(slot_id)
	)
	row.add_child(save_button)

	var load_button: Button = _make_button("读取")
	load_button.disabled = not bool(metadata.get("exists", false)) or not bool(metadata.get("compatible", true))
	load_button.pressed.connect(func() -> void:
		request_load_slot(slot_id)
	)
	row.add_child(load_button)

	var delete_button: Button = _make_button("删除")
	delete_button.disabled = not bool(metadata.get("exists", false))
	delete_button.pressed.connect(func() -> void:
		request_delete_slot(slot_id)
	)
	row.add_child(delete_button)

func _slot_title(slot_id: String) -> String:
	if slot_id == "quick":
		return "快速存档"
	if slot_id.begins_with("slot_"):
		return "槽位 %s" % slot_id.trim_prefix("slot_")
	return slot_id

func _slot_desc(metadata: Dictionary) -> String:
	if not bool(metadata.get("exists", false)):
		return "空槽位"
	if not bool(metadata.get("compatible", true)):
		return "存档版本不兼容：%s" % str(metadata.get("version_warning", "无法读取"))
	var saved_at: float = _num(metadata.get("saved_at_unix", 0))
	var time_text: String = "未知时间"
	if saved_at > 0.0:
		var date: Dictionary = Time.get_datetime_dict_from_unix_time(int(saved_at))
		time_text = "%04d-%02d-%02d %02d:%02d" % [
			int(date.get("year", 0)),
			int(date.get("month", 0)),
			int(date.get("day", 0)),
			int(date.get("hour", 0)),
			int(date.get("minute", 0))
		]
	return "%s · %d年%d月 · 第%d回合 · %s" % [
		str(metadata.get("scenario_name", "未知剧本")),
		int(_num(metadata.get("year", 0))),
		int(_num(metadata.get("month", 0))),
		int(_num(metadata.get("turn", 0))),
		time_text
	]

func _make_button(text: String) -> Button:
	var button: Button = Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(64, 30)
	return button

func _make_label(text: String, font_size: int, color: Color) -> Label:
	var label: Label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

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

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
