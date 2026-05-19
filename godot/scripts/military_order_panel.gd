extends PanelContainer

class_name MilitaryOrderPanel

signal military_order_requested(order_id: String, target_region_id: String)

var orders_box: VBoxContainer
var regions_box: VBoxContainer
var detail_label: Label
var history_label: Label
var issue_button: Button
var selected_order_id: String = ""
var selected_region_id: String = ""
var current_history: Array = []

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

	left.add_child(_make_label("军令", 21, Color(0.88, 0.72, 0.42)))
	orders_box = VBoxContainer.new()
	orders_box.add_theme_constant_override("separation", 6)
	left.add_child(orders_box)
	history_label = _make_label("", 12, Color(0.62, 0.58, 0.50))
	left.add_child(history_label)

	var right: VBoxContainer = VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	root.add_child(right)

	detail_label = _make_label("选择军令与目标地块。", 14, Color(0.86, 0.78, 0.64))
	right.add_child(detail_label)

	var scroll: ScrollContainer = ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(scroll)
	regions_box = VBoxContainer.new()
	regions_box.add_theme_constant_override("separation", 5)
	scroll.add_child(regions_box)

	issue_button = Button.new()
	issue_button.text = "下达军令"
	issue_button.custom_minimum_size.y = 34
	issue_button.pressed.connect(_on_issue_pressed)
	right.add_child(issue_button)
	set_data([], [], [], 0)

func set_data(orders: Array, regions: Array, issued_history: Array, action_points: int) -> void:
	if orders_box == null:
		return
	current_history = issued_history
	if (selected_order_id.is_empty() or _order_by_id(orders, selected_order_id).is_empty()) and not orders.is_empty():
		selected_order_id = str(_dict(orders[0]).get("id", ""))
	elif orders.is_empty():
		selected_order_id = ""
	if selected_region_id.is_empty() or _region_by_id(regions, selected_region_id).is_empty():
		selected_region_id = _first_region_id(regions)
	_clear_box(orders_box)
	for raw in orders:
		var order: Dictionary = _dict(raw)
		var order_id: String = str(order.get("id", ""))
		var button: Button = Button.new()
		button.text = "%s  [%s / %d点]\n%s" % [
			str(order.get("name", "")),
			str(order.get("category", "")),
			max(1, int(_num(order.get("cost", 1)))),
			str(order.get("desc", ""))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if order_id == selected_order_id else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_order_id = order_id
			set_data(orders, regions, issued_history, action_points)
		)
		orders_box.add_child(button)
	_update_regions(orders, regions, action_points)
	history_label.text = _history_text(issued_history)

func visible_text() -> String:
	return "军令\n%s\n%s" % [
		"" if detail_label == null else detail_label.text,
		"" if history_label == null else history_label.text
	]

func _update_regions(orders: Array, regions: Array, action_points: int) -> void:
	_clear_box(regions_box)
	var order: Dictionary = _order_by_id(orders, selected_order_id)
	var cost: int = max(1, int(_num(order.get("cost", 1))))
	detail_label.text = "%s\n%s" % [
		str(order.get("name", "未选择军令")),
		"选择一处地块作为军令目标"
	]
	issue_button.disabled = action_points < cost or selected_region_id.is_empty()

	for raw in regions:
		var region: Dictionary = _dict(raw)
		var region_id: String = str(region.get("id", ""))
		if region_id.is_empty():
			continue
		var button: Button = Button.new()
		button.text = "%s  兵力%s  兵压%d  不稳%d" % [
			str(region.get("name", "")),
			_big(int(_num(region.get("troops", 0)))),
			int(_num(region.get("army_pressure", 0))),
			int(_num(region.get("unrest", 0)))
		]
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.modulate = Color(1.0, 0.86, 0.55, 1.0) if region_id == selected_region_id else Color.WHITE
		button.pressed.connect(func() -> void:
			selected_region_id = region_id
			set_data(orders, regions, current_history, action_points)
		)
		regions_box.add_child(button)

func _on_issue_pressed() -> void:
	emit_signal("military_order_requested", selected_order_id, selected_region_id)

func _order_by_id(orders: Array, order_id: String) -> Dictionary:
	for raw in orders:
		var order: Dictionary = _dict(raw)
		if str(order.get("id", "")) == order_id:
			return order
	return {}

func _first_region_id(regions: Array) -> String:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		var id: String = str(region.get("id", ""))
		if not id.is_empty():
			return id
	return ""

func _region_by_id(regions: Array, region_id: String) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("id", "")) == region_id:
			return region
	return {}

func _history_text(history: Array) -> String:
	if history.is_empty():
		return "近期军令：无"
	var names: PackedStringArray = PackedStringArray()
	for raw in history:
		var record: Dictionary = _dict(raw)
		var parts: PackedStringArray = PackedStringArray()
		parts.append("T%d %s / %s" % [
			int(_num(record.get("turn", 0))),
			str(record.get("name", "")),
			str(record.get("target_region", ""))
		])
		if record.has("cost"):
			parts.append("耗行动点 %d" % int(_num(record.get("cost", 0))))
		var applied_text: String = _effect_text(_dict(record.get("applied", {})))
		if not applied_text.is_empty():
			parts.append("朝廷 %s" % applied_text)
		var region_text: String = _effect_text(_dict(record.get("region_applied", {})))
		if not region_text.is_empty():
			parts.append("地方 %s" % region_text)
		names.append(" / ".join(parts))
	return "近期军令：%s" % "；".join(names)

func _effect_text(values: Dictionary) -> String:
	if values.is_empty():
		return ""
	var parts: PackedStringArray = PackedStringArray()
	for key in values.keys():
		parts.append("%s %s" % [_effect_label(str(key)), _signed_big(_num(values.get(key, 0)))])
	return "，".join(parts)

func _effect_label(key: String) -> String:
	match key:
		"treasury_money", "帑廪":
			return "国库银"
		"inner_treasury_money":
			return "内帑"
		"treasury_grain":
			return "国库粮"
		"huangquan", "imperial_authority":
			return "皇权"
		"huangwei", "imperial_prestige":
			return "皇威"
		"troops":
			return "兵力"
		"army_pressure":
			return "兵压"
		"unrest":
			return "不稳"
		"mood":
			return "民心"
	return key

func _signed_big(value: float) -> String:
	if value > 0.0:
		return "+%s" % _fmt_big(value)
	if value < 0.0:
		return "-%s" % _fmt_big(absf(value))
	return "0"

func _fmt_big(value: float) -> String:
	if value >= 100000000.0:
		return "%.1f亿" % (value / 100000000.0)
	if value >= 10000.0:
		return "%.1f万" % (value / 10000.0)
	if is_equal_approx(value, roundf(value)):
		return "%d" % roundi(value)
	return "%.1f" % value

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

func _big(value: int) -> String:
	if abs(value) >= 10000:
		return "%.1f万" % (float(value) / 10000.0)
	return str(value)

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
