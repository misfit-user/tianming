extends Node

const TitleScene := preload("res://scenes/title.tscn")

func _ready() -> void:
	var title: Node = TitleScene.instantiate()
	add_child(title)
	await get_tree().process_frame

	if not title.has_method("open_settings_menu") or not title.has_method("apply_title_settings"):
		_fail("Title screen does not expose settings menu methods")
		return
	var settings_manager: RefCounted = title.get("settings_manager") as RefCounted
	if settings_manager == null:
		_fail("Title screen did not initialize SettingsManager")
		return
	if settings_manager.has_method("delete_settings_file"):
		settings_manager.call("delete_settings_file")

	title.call("open_settings_menu")
	await get_tree().process_frame
	var apply_result: Dictionary = title.call("apply_title_settings", {
		"fullscreen": false,
		"ui_scale": 1.2,
		"master_volume": 0.4
	})
	if not apply_result.get("ok", false):
		_fail("Title settings apply failed: %s" % str(apply_result.get("error", "")))
		return
	var snapshot: Dictionary = settings_manager.call("settings_snapshot")
	if bool(snapshot.get("fullscreen", true)):
		_fail("Title settings did not update fullscreen")
		return
	if not is_equal_approx(float(snapshot.get("ui_scale", 0)), 1.2):
		_fail("Title settings did not update UI scale")
		return
	if not is_equal_approx(float(snapshot.get("master_volume", 0)), 0.4):
		_fail("Title settings did not update master volume")
		return

	settings_manager.call("delete_settings_file")
	print("[TianmingGodotTest] title settings scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _fail(message: String) -> void:
	print("[TianmingGodotTest] title settings scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] title settings scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
