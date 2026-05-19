extends Control

class_name TitleScreen

const MainScene := preload("res://scenes/main.tscn")
const SaveManagerScript := preload("res://scripts/save_manager.gd")
const SettingsManagerScript := preload("res://scripts/settings_manager.gd")

var save_manager: RefCounted
var settings_manager: RefCounted
var current_main: Node
var title_panel: PanelContainer
var continue_button: Button
var status_label: Label
var load_slots_box: VBoxContainer
var settings_box: VBoxContainer

func _ready() -> void:
	save_manager = SaveManagerScript.new()
	settings_manager = SettingsManagerScript.new()
	settings_manager.call("load_settings")
	_build_ui()
	refresh_continue_state()

func start_new_game() -> Dictionary:
	_clear_current_main()
	current_main = MainScene.instantiate()
	add_child(current_main)
	current_main.set_anchors_preset(Control.PRESET_FULL_RECT)
	title_panel.visible = false
	return {"ok": true}

func continue_game() -> Dictionary:
	return load_game_slot("quick")

func load_game_slot(slot_id: String) -> Dictionary:
	_clear_current_main()
	current_main = MainScene.instantiate()
	add_child(current_main)
	current_main.set_anchors_preset(Control.PRESET_FULL_RECT)
	title_panel.visible = false
	var state: RefCounted = current_main.get("game_state") as RefCounted
	if state == null:
		return {
			"ok": false,
			"error": "main scene did not initialize game state"
		}
	var result: Dictionary = save_manager.call("restore_slot", state, slot_id)
	if not result.get("ok", false):
		title_panel.visible = true
		_clear_current_main()
		_set_status("读取失败：%s" % str(result.get("error", "")))
		return result
	if current_main.has_method("_refresh_runtime_bar"):
		current_main.call("_refresh_runtime_bar")
	print("[TianmingGodot] title loaded slot %s" % slot_id)
	return result

func return_to_title() -> void:
	_clear_current_main()
	title_panel.visible = true
	refresh_continue_state()

func has_continue_save() -> bool:
	if save_manager == null:
		return false
	var metadata: Dictionary = save_manager.call("slot_metadata", "quick")
	return bool(metadata.get("exists", false))

func refresh_continue_state() -> void:
	var exists: bool = has_continue_save()
	if continue_button != null:
		continue_button.disabled = not exists
	if exists:
		var metadata: Dictionary = save_manager.call("slot_metadata", "quick")
		_set_status("快速存档：%d年%d月 · 第%d回合" % [
			int(_num(metadata.get("year", 0))),
			int(_num(metadata.get("month", 0))),
			int(_num(metadata.get("turn", 0)))
		])
	else:
		_set_status("暂无快速存档。")
	if load_slots_box != null and load_slots_box.visible:
		refresh_load_slots()

func open_load_menu() -> void:
	if load_slots_box == null:
		return
	load_slots_box.visible = true
	refresh_load_slots()

func refresh_load_slots() -> void:
	if load_slots_box == null or save_manager == null:
		return
	for child in load_slots_box.get_children():
		child.queue_free()
	load_slots_box.add_child(_make_label("读取存档", 16, Color(0.88, 0.72, 0.42), HORIZONTAL_ALIGNMENT_LEFT))
	for raw in save_manager.call("list_slots"):
		_add_load_slot_row(_dict(raw))

func open_settings_menu() -> void:
	if settings_box == null:
		return
	settings_box.visible = true
	refresh_settings_menu()

func refresh_settings_menu() -> void:
	if settings_box == null or settings_manager == null:
		return
	for child in settings_box.get_children():
		child.queue_free()
	var snapshot: Dictionary = settings_manager.call("settings_snapshot")
	settings_box.add_child(_make_label("设置", 16, Color(0.88, 0.72, 0.42), HORIZONTAL_ALIGNMENT_LEFT))
	settings_box.add_child(_make_label("窗口：%s" % ("全屏" if bool(snapshot.get("fullscreen", false)) else "窗口"), 13, Color(0.78, 0.72, 0.62), HORIZONTAL_ALIGNMENT_LEFT))
	settings_box.add_child(_make_label("界面缩放：%.2f" % _num(snapshot.get("ui_scale", 1.0)), 13, Color(0.78, 0.72, 0.62), HORIZONTAL_ALIGNMENT_LEFT))
	settings_box.add_child(_make_label("主音量：%d%%" % roundi(_num(snapshot.get("master_volume", 0.8)) * 100.0), 13, Color(0.78, 0.72, 0.62), HORIZONTAL_ALIGNMENT_LEFT))

func apply_title_settings(values: Dictionary) -> Dictionary:
	if settings_manager == null:
		return {
			"ok": false,
			"error": "settings manager is not ready"
		}
	var result: Dictionary = settings_manager.call("update_settings", values)
	if not result.get("ok", false):
		_set_status("设置失败：%s" % str(result.get("error", "")))
		return result
	_set_status("设置已保存。")
	refresh_settings_menu()
	return result

func _build_ui() -> void:
	var background: ColorRect = ColorRect.new()
	background.color = Color(0.07, 0.055, 0.04, 1)
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	title_panel = PanelContainer.new()
	title_panel.set_anchors_preset(Control.PRESET_CENTER)
	title_panel.custom_minimum_size = Vector2(560, 520)
	title_panel.offset_left = -280
	title_panel.offset_top = -260
	title_panel.offset_right = 280
	title_panel.offset_bottom = 260
	add_child(title_panel)

	var margin: MarginContainer = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_bottom", 24)
	title_panel.add_child(margin)

	var root: VBoxContainer = VBoxContainer.new()
	root.add_theme_constant_override("separation", 14)
	margin.add_child(root)

	var title: Label = _make_label("天命", 36, Color(0.90, 0.76, 0.45), HORIZONTAL_ALIGNMENT_CENTER)
	root.add_child(title)
	var subtitle: Label = _make_label("Godot 重构版", 17, Color(0.78, 0.70, 0.58), HORIZONTAL_ALIGNMENT_CENTER)
	root.add_child(subtitle)

	status_label = _make_label("", 14, Color(0.76, 0.68, 0.54), HORIZONTAL_ALIGNMENT_CENTER)
	root.add_child(status_label)

	var buttons: VBoxContainer = VBoxContainer.new()
	buttons.add_theme_constant_override("separation", 10)
	root.add_child(buttons)

	var new_button: Button = _make_button("新局")
	new_button.pressed.connect(func() -> void:
		start_new_game()
	)
	buttons.add_child(new_button)

	continue_button = _make_button("继续")
	continue_button.pressed.connect(func() -> void:
		continue_game()
	)
	buttons.add_child(continue_button)

	var load_button: Button = _make_button("读取存档")
	load_button.pressed.connect(func() -> void:
		open_load_menu()
	)
	buttons.add_child(load_button)

	var settings_button: Button = _make_button("设置")
	settings_button.pressed.connect(func() -> void:
		open_settings_menu()
	)
	buttons.add_child(settings_button)

	var quit_button: Button = _make_button("退出")
	quit_button.pressed.connect(func() -> void:
		get_tree().quit(0)
	)
	buttons.add_child(quit_button)

	load_slots_box = VBoxContainer.new()
	load_slots_box.add_theme_constant_override("separation", 7)
	load_slots_box.visible = false
	root.add_child(load_slots_box)

	settings_box = VBoxContainer.new()
	settings_box.add_theme_constant_override("separation", 7)
	settings_box.visible = false
	root.add_child(settings_box)

func _add_load_slot_row(metadata: Dictionary) -> void:
	var row: HBoxContainer = HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	load_slots_box.add_child(row)

	var info: Label = _make_label(_slot_desc(metadata), 13, Color(0.78, 0.72, 0.62), HORIZONTAL_ALIGNMENT_LEFT)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)

	var button: Button = Button.new()
	button.text = "读取"
	button.custom_minimum_size = Vector2(64, 28)
	button.disabled = not bool(metadata.get("exists", false))
	var slot_id: String = str(metadata.get("slot_id", "quick"))
	button.pressed.connect(func() -> void:
		load_game_slot(slot_id)
	)
	row.add_child(button)

func _clear_current_main() -> void:
	if current_main == null:
		return
	current_main.queue_free()
	current_main = null

func _set_status(text: String) -> void:
	if status_label != null:
		status_label.text = text

func _make_button(text: String) -> Button:
	var button: Button = Button.new()
	button.text = text
	button.custom_minimum_size.y = 38
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return button

func _make_label(text: String, font_size: int, color: Color, alignment: HorizontalAlignment) -> Label:
	var label: Label = Label.new()
	label.text = text
	label.horizontal_alignment = alignment
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func _slot_desc(metadata: Dictionary) -> String:
	var slot_id: String = str(metadata.get("slot_id", "quick"))
	var slot_name: String = "快速存档" if slot_id == "quick" else "槽位 %s" % slot_id.trim_prefix("slot_")
	if not bool(metadata.get("exists", false)):
		return "%s：空" % slot_name
	return "%s：%d年%d月 · 第%d回合" % [
		slot_name,
		int(_num(metadata.get("year", 0))),
		int(_num(metadata.get("month", 0))),
		int(_num(metadata.get("turn", 0)))
	]

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}
