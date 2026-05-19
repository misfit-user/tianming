extends PanelContainer

class_name SystemPanel

signal quick_save_requested
signal quick_load_requested
signal settings_apply_requested(values: Dictionary)
signal return_title_requested

var status_label: Label
var settings_label: Label
var quick_label: Label

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
	root.add_theme_constant_override("separation", 11)
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_child(root)

	root.add_child(_make_label("系统", 21, Color(0.88, 0.72, 0.42)))
	status_label = _make_label("系统菜单已就绪。", 13, Color(0.78, 0.70, 0.58))
	root.add_child(status_label)

	var save_panel: PanelContainer = PanelContainer.new()
	root.add_child(save_panel)
	var save_margin: MarginContainer = _make_margin()
	save_panel.add_child(save_margin)
	var save_box: VBoxContainer = VBoxContainer.new()
	save_box.add_theme_constant_override("separation", 8)
	save_margin.add_child(save_box)
	save_box.add_child(_make_label("快速存读", 16, Color(0.90, 0.82, 0.64)))
	quick_label = _make_label("", 13, Color(0.78, 0.72, 0.62))
	save_box.add_child(quick_label)
	var save_row: HBoxContainer = HBoxContainer.new()
	save_row.add_theme_constant_override("separation", 8)
	save_box.add_child(save_row)
	var save_button: Button = _make_button("快速保存")
	save_button.pressed.connect(func() -> void:
		emit_signal("quick_save_requested")
	)
	save_row.add_child(save_button)
	var load_button: Button = _make_button("快速读取")
	load_button.pressed.connect(func() -> void:
		emit_signal("quick_load_requested")
	)
	save_row.add_child(load_button)

	var settings_panel: PanelContainer = PanelContainer.new()
	root.add_child(settings_panel)
	var settings_margin: MarginContainer = _make_margin()
	settings_panel.add_child(settings_margin)
	var settings_box: VBoxContainer = VBoxContainer.new()
	settings_box.add_theme_constant_override("separation", 8)
	settings_margin.add_child(settings_box)
	settings_box.add_child(_make_label("设置", 16, Color(0.90, 0.82, 0.64)))
	settings_label = _make_label("", 13, Color(0.78, 0.72, 0.62))
	settings_box.add_child(settings_label)
	var settings_row: HBoxContainer = HBoxContainer.new()
	settings_row.add_theme_constant_override("separation", 8)
	settings_box.add_child(settings_row)
	var windowed_button: Button = _make_button("窗口")
	windowed_button.pressed.connect(func() -> void:
		emit_signal("settings_apply_requested", {"fullscreen": false})
	)
	settings_row.add_child(windowed_button)
	var scale_button: Button = _make_button("界面 1.25")
	scale_button.pressed.connect(func() -> void:
		emit_signal("settings_apply_requested", {"ui_scale": 1.25})
	)
	settings_row.add_child(scale_button)
	var volume_button: Button = _make_button("音量 80%")
	volume_button.pressed.connect(func() -> void:
		emit_signal("settings_apply_requested", {"master_volume": 0.8})
	)
	settings_row.add_child(volume_button)

	var return_button: Button = _make_button("返回标题")
	return_button.custom_minimum_size.y = 36
	return_button.pressed.connect(func() -> void:
		emit_signal("return_title_requested")
	)
	root.add_child(return_button)

	set_data({}, false)

func set_data(settings: Dictionary, has_quick_save: bool) -> void:
	if quick_label != null:
		quick_label.text = "快速存档：%s" % ("可读取" if has_quick_save else "暂无")
	if settings_label != null:
		settings_label.text = "窗口：%s · 界面 %.2f · 音量 %d%%" % [
			"全屏" if bool(settings.get("fullscreen", false)) else "窗口",
			_num(settings.get("ui_scale", 1.0)),
			roundi(_num(settings.get("master_volume", 0.8)) * 100.0)
		]

func set_status(text: String) -> void:
	if status_label != null:
		status_label.text = text

func visible_text() -> String:
	return "系统\n%s\n%s\n%s" % [
		"" if status_label == null else status_label.text,
		"" if quick_label == null else quick_label.text,
		"" if settings_label == null else settings_label.text
	]

func _make_margin() -> MarginContainer:
	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 8)
	return margin

func _make_button(text: String) -> Button:
	var button: Button = Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(92, 30)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return button

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
