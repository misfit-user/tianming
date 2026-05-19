extends Node

const TitleScene := preload("res://scenes/title.tscn")

func _ready() -> void:
	var title: Node = TitleScene.instantiate()
	add_child(title)
	await get_tree().process_frame

	var new_result: Dictionary = title.call("start_new_game")
	await get_tree().process_frame
	if not new_result.get("ok", false):
		_fail("Starting new game from title failed")
		return

	var main: Node = title.get("current_main") as Node
	if main == null:
		_fail("Title screen did not create main scene")
		return
	var system_panel: Node = _find_node_with_script(main, "res://scripts/system_panel.gd")
	if system_panel == null:
		_fail("Main scene does not expose the system panel")
		return
	if not system_panel.has_signal("quick_save_requested") or not system_panel.has_signal("quick_load_requested"):
		_fail("System panel does not expose quick save/load signals")
		return
	if not system_panel.has_signal("settings_apply_requested") or not system_panel.has_signal("return_title_requested"):
		_fail("System panel does not expose settings/return-title signals")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	var save_manager: RefCounted = main.get("save_manager") as RefCounted
	var settings_manager: RefCounted = main.get("settings_manager") as RefCounted
	if game_state == null or save_manager == null or settings_manager == null:
		_fail("Main scene did not initialize game/save/settings managers")
		return

	save_manager.call("delete_slot", "quick")
	var turn_before: int = int(game_state.get("turn"))
	system_panel.emit_signal("quick_save_requested")
	await get_tree().process_frame
	game_state.call("advance_month")
	await get_tree().process_frame
	system_panel.emit_signal("quick_load_requested")
	await get_tree().process_frame
	if int(game_state.get("turn")) != turn_before:
		_fail("System panel quick load did not restore saved turn")
		return

	system_panel.emit_signal("settings_apply_requested", {
		"fullscreen": false,
		"ui_scale": 1.3,
		"master_volume": 0.45
	})
	await get_tree().process_frame
	var settings: Dictionary = settings_manager.call("settings_snapshot")
	if not is_equal_approx(float(settings.get("ui_scale", 0)), 1.3):
		_fail("System panel did not apply UI scale setting")
		return
	if not is_equal_approx(float(settings.get("master_volume", 0)), 0.45):
		_fail("System panel did not apply master volume setting")
		return

	system_panel.emit_signal("return_title_requested")
	await get_tree().process_frame
	if title.get("current_main") != null:
		_fail("System panel did not return to title")
		return

	save_manager.call("delete_slot", "quick")
	settings_manager.call("delete_settings_file")
	print("[TianmingGodotTest] system menu UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	print("[TianmingGodotTest] system menu UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] system menu UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
