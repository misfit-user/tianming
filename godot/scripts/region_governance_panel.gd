extends PanelContainer

class_name RegionGovernancePanel

signal region_governance_requested(region_id: String, action_id: String)

var regions_box: VBoxContainer
var actions_box: VBoxContainer
var detail_label: Label
var history_label: Label
var selected_region_id: String = ""
var current_regions: Array = []
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

	left.add_child(_make_label("地块", 20, Color(0.88, 0.72, 0.42)))
	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(scroll)
	regions_box = VBoxContainer.new()
	regions_box.add_theme_constant_override("separation", 4)
	scroll.add_child(regions_box)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	root.add_child(right)

	detail_label = _make_label("选择地块后执行地方治理。", 14, Color(0.86, 0.78, 0.64))
	right.add_child(detail_label)
	right.add_child(_make_label("治理动作", 15, Color(0.88, 0.72, 0.42)))
	actions_box = VBoxContainer.new()
	actions_box.add_theme_constant_override("separation", 6)
	right.add_child(actions_box)
	history_label = _make_label("地方治理记录：无", 12, Color(0.68, 0.62, 0.50))
	history_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(history_label)
	set_data([], [], [], 0)

func set_data(regions: Array, actions: Array, history: Array, action_points: int) -> void:
	current_regions = regions.duplicate(true)
	current_actions = actions.duplicate(true)
	current_history = history.duplicate(true)
	current_action_points = action_points
	if regions_box == null:
		return
	if (selected_region_id.is_empty() or _selected_region().is_empty()) and current_regions.size() > 0:
		selected_region_id = str(_dict(current_regions[0]).get("id", ""))
	elif current_regions.is_empty():
		selected_region_id = ""
	_refresh_regions()
	_refresh_detail()

func visible_text() -> String:
	return "地块治理\n%s\n%s\n%s" % [
		str(_selected_region().get("name", "")),
		detail_label.text if detail_label != null else "",
		_history_text()
	]

func _refresh_regions() -> void:
	_clear_box(regions_box)
	for raw in current_regions:
		var region: Dictionary = _dict(raw)
		var region_id: String = str(region.get("id", ""))
		if region_id.is_empty():
			continue
		var button: Button = Button.new()
		button.text = "%s  %s\n繁荣 %d · 民心 %d · 不稳 %d · 税压 %d · 兵压 %d" % [
			str(region.get("name", "")),
			str(region.get("owner", region.get("owner_id", ""))),
			int(_num(region.get("prosperity", 0))),
			int(_num(region.get("mood", 0))),
			int(_num(region.get("unrest", 0))),
			int(_num(region.get("tax_pressure", 0))),
			int(_num(region.get("army_pressure", 0)))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if region_id == selected_region_id else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_region_id = region_id
			_refresh_regions()
			_refresh_detail()
		)
		regions_box.add_child(button)

func _refresh_detail() -> void:
	_clear_box(actions_box)
	var region: Dictionary = _selected_region()
	if region.is_empty():
		detail_label.text = "选择地块后执行地方治理。"
		history_label.text = "地方治理记录：无"
		return
	detail_label.text = "%s\n归属 %s / 控制 %s · 地形 %s\n开发 %d · 驻军 %s · 府州 %d处\n主官 %s · 统兵 %s" % [
		str(region.get("name", "")),
		str(region.get("owner", region.get("owner_id", ""))),
		str(region.get("controller", region.get("controller_id", ""))),
		str(region.get("terrain", "")),
		int(_num(region.get("development", 0))),
		_fmt_big(_num(region.get("troops", 0)), ""),
		int(_num(region.get("prefecture_count", 0))),
		_region_personnel(region, "governor"),
		_region_personnel(region, "commander")
	]
	for raw in current_actions:
		var action: Dictionary = _dict(raw)
		var action_id: String = str(action.get("id", ""))
		if action_id.is_empty():
			continue
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
			emit_signal("region_governance_requested", selected_region_id, action_id)
		)
		actions_box.add_child(button)
	history_label.text = _history_text()

func _selected_region() -> Dictionary:
	for raw in current_regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("id", "")) == selected_region_id:
			return region
	return {}

func _history_text() -> String:
	var lines: PackedStringArray = PackedStringArray()
	for raw in current_history:
		var record: Dictionary = _dict(raw)
		if not selected_region_id.is_empty() and str(record.get("target_region_id", "")) != selected_region_id:
			continue
		lines.append("第%d回合 %s：%s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("action", "")),
			str(record.get("outcome", record.get("description", "")))
		])
	if lines.is_empty():
		return "地方治理记录：无"
	return "地方治理记录：\n%s" % "\n".join(lines)

func _clear_box(box: BoxContainer) -> void:
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

func _fmt_big(value: float, suffix: String = "") -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿%s" % [value / 100000000.0, suffix]
	if abs_value >= 10000.0:
		return "%.1f万%s" % [value / 10000.0, suffix]
	return "%d%s" % [roundi(value), suffix]

func _region_personnel(region: Dictionary, key: String) -> String:
	var value: String = str(region.get(key, ""))
	return value if not value.is_empty() else "未任"

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
