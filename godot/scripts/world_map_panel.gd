extends MarginContainer

class_name WorldMapPanel

const WorldMapViewScript := preload("res://scripts/world_map_view.gd")

signal region_selected(region: Dictionary)
signal region_edict_requested(edict_id: String)
signal region_military_order_requested(order_id: String)

var world_map_view: Control
var map_detail_title: Label
var map_detail_owner: Label
var map_detail_stats: Label
var map_detail_resources: Label
var map_detail_neighbors: Label
var map_detail_prefectures: Label
var map_quick_status: Label
var selected_map_region: Dictionary = {}

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

	world_map_view = WorldMapViewScript.new()
	world_map_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	world_map_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	world_map_view.custom_minimum_size = Vector2(520, 260)
	world_map_view.connect("region_selected", Callable(self, "_on_view_region_selected"))
	layout.add_child(world_map_view)
	_add_detail_panel(layout)

func set_map_data(map_data: Dictionary) -> void:
	if world_map_view == null:
		return
	world_map_view.call("set_map_data", map_data)
	if selected_map_region.is_empty():
		return
	var selected_id: String = selected_region_runtime_id()
	var refreshed: Dictionary = _region_by_id(_safe_array(map_data.get("regions", [])), selected_id)
	if refreshed.is_empty():
		clear_selection()
	else:
		set_selected_region(refreshed)

func select_region_by_index(index: int) -> void:
	if world_map_view == null:
		return
	world_map_view.call("select_region_by_index", index)

func set_selected_region(region: Dictionary) -> void:
	_on_view_region_selected(region)

func clear_selection() -> void:
	selected_map_region = {}
	if map_detail_title == null:
		return
	map_detail_title.text = "点击地块"
	map_detail_owner.text = "未选择"
	map_detail_stats.text = "未选择"
	map_detail_resources.text = "无"
	map_detail_neighbors.text = "无"
	map_detail_prefectures.text = "无"
	if map_quick_status != null:
		map_quick_status.text = "当前地块已不在运行态地图中，请重新选择。"

func selected_region_runtime_id() -> String:
	if selected_map_region.is_empty():
		return ""
	var id: String = str(selected_map_region.get("id", ""))
	if not id.is_empty():
		return id
	return str(selected_map_region.get("name", ""))

func set_quick_status(text: String) -> void:
	if map_quick_status != null:
		map_quick_status.text = text

func visible_text() -> String:
	return "天下图\n%s\n归属\n%s\n治理\n%s\n资源\n%s\n邻接\n%s\n府州\n%s\n地块指令\n%s" % [
		"" if map_detail_title == null else map_detail_title.text,
		"" if map_detail_owner == null else map_detail_owner.text,
		"" if map_detail_stats == null else map_detail_stats.text,
		"" if map_detail_resources == null else map_detail_resources.text,
		"" if map_detail_neighbors == null else map_detail_neighbors.text,
		"" if map_detail_prefectures == null else map_detail_prefectures.text,
		"" if map_quick_status == null else map_quick_status.text
	]

func _add_detail_panel(parent: BoxContainer) -> void:
	var panel: PanelContainer = PanelContainer.new()
	panel.custom_minimum_size.x = 290
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	parent.add_child(panel)

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)

	var detail_box: VBoxContainer = VBoxContainer.new()
	detail_box.add_theme_constant_override("separation", 8)
	margin.add_child(detail_box)

	map_detail_title = Label.new()
	map_detail_title.text = "点击地块"
	map_detail_title.add_theme_font_size_override("font_size", 20)
	map_detail_title.add_theme_color_override("font_color", Color(0.88, 0.72, 0.42))
	map_detail_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_box.add_child(map_detail_title)

	map_detail_owner = _add_detail_value(detail_box, "归属")
	map_detail_stats = _add_detail_value(detail_box, "治理")
	map_detail_resources = _add_detail_value(detail_box, "资源")
	map_detail_neighbors = _add_detail_value(detail_box, "邻接")
	map_detail_prefectures = _add_detail_value(detail_box, "府州")

	var action_caption: Label = Label.new()
	action_caption.text = "地块指令"
	action_caption.add_theme_font_size_override("font_size", 13)
	action_caption.add_theme_color_override("font_color", Color(0.67, 0.56, 0.38))
	detail_box.add_child(action_caption)

	var action_row: HBoxContainer = HBoxContainer.new()
	action_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	action_row.add_theme_constant_override("separation", 8)
	detail_box.add_child(action_row)

	var edict_button: Button = Button.new()
	edict_button.text = "减派蠲税"
	edict_button.tooltip_text = "对当前选中地块发布民生诏令"
	edict_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	edict_button.pressed.connect(func() -> void:
		emit_signal("region_edict_requested", "reduce_regional_levy")
	)
	action_row.add_child(edict_button)

	var order_button: Button = Button.new()
	order_button.text = "增援驻防"
	order_button.tooltip_text = "对当前选中地块发布军令"
	order_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	order_button.pressed.connect(func() -> void:
		emit_signal("region_military_order_requested", "reinforce_garrison")
	)
	action_row.add_child(order_button)

	map_quick_status = Label.new()
	map_quick_status.text = "先选中地块。"
	map_quick_status.add_theme_font_size_override("font_size", 13)
	map_quick_status.add_theme_color_override("font_color", Color(0.78, 0.66, 0.45))
	map_quick_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_box.add_child(map_quick_status)

func _add_detail_value(parent: VBoxContainer, caption: String) -> Label:
	var caption_label: Label = Label.new()
	caption_label.text = caption
	caption_label.add_theme_font_size_override("font_size", 13)
	caption_label.add_theme_color_override("font_color", Color(0.67, 0.56, 0.38))
	parent.add_child(caption_label)
	var value_label: Label = Label.new()
	value_label.text = "未选择"
	value_label.add_theme_font_size_override("font_size", 14)
	value_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	value_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(value_label)
	return value_label

func _on_view_region_selected(region: Dictionary) -> void:
	selected_map_region = region.duplicate(true)
	if map_detail_title == null:
		return
	map_detail_title.text = str(region.get("name", "未命名地块"))
	map_detail_owner.text = "%s / %s" % [
		str(region.get("owner", "")),
		str(region.get("controller", ""))
	]
	map_detail_stats.text = "地形 %s · 繁荣 %d · 开发 %d\n驻军 %s · 民心 %d · 不稳 %d\n税压 %d · 兵压 %d\n主官 %s · 统兵 %s" % [
		str(region.get("terrain", "")),
		int(_num(region.get("prosperity", 0))),
		int(_num(region.get("development", 0))),
		_fmt_big(_num(region.get("troops", 0))),
		int(_num(region.get("mood", 0))),
		int(_num(region.get("unrest", 0))),
		int(_num(region.get("tax_pressure", 0))),
		int(_num(region.get("army_pressure", 0))),
		_region_personnel_text(region, "governor"),
		_region_personnel_text(region, "commander")
	]
	map_detail_resources.text = _join_values(_safe_array(region.get("resources", [])), "、", "无")
	map_detail_neighbors.text = _join_values(_safe_array(region.get("neighbors", [])), "、", "无")
	var prefectures: Array = _safe_array(region.get("prefectures", []))
	var count_text: String = "%d处" % int(_num(region.get("prefecture_count", prefectures.size())))
	map_detail_prefectures.text = "%s\n%s" % [
		count_text,
		_join_values(prefectures, "、", "无")
	]
	if map_quick_status != null:
		map_quick_status.text = "已选中 %s，可直接发地块指令。" % str(region.get("name", "此地块"))
	emit_signal("region_selected", selected_map_region)

func _region_by_id(rows: Array, region_id: String) -> Dictionary:
	if region_id.is_empty():
		return {}
	for raw in rows:
		var region: Dictionary = _safe_dict(raw)
		var id: String = str(region.get("id", ""))
		if id.is_empty():
			id = str(region.get("name", ""))
		if id == region_id or str(region.get("name", "")) == region_id:
			return region
	return {}

func _region_personnel_text(region: Dictionary, key: String) -> String:
	var value: String = str(region.get(key, ""))
	return value if not value.is_empty() else "未任"

func _join_values(values: Array, separator: String, fallback: String) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for raw in values:
		var text: String = str(raw)
		if not text.is_empty():
			parts.append(text)
	if parts.size() == 0:
		return fallback
	return separator.join(parts)

func _fmt_big(value: float) -> String:
	var abs_value: float = absf(value)
	if abs_value >= 100000000.0:
		return "%.1f亿" % (value / 100000000.0)
	if abs_value >= 10000.0:
		return "%.1f万" % (value / 10000.0)
	return "%d" % roundi(value)

func _safe_dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _safe_array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()
