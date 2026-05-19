extends Node

func _ready() -> void:
	var SettingsManagerScript: Script = load("res://scripts/settings_manager.gd")
	if SettingsManagerScript == null:
		_fail("SettingsManager script is missing")
		return
	var manager: RefCounted = SettingsManagerScript.new()
	if not manager.has_method("load_settings") or not manager.has_method("save_settings") or not manager.has_method("update_setting"):
		_fail("SettingsManager does not expose load/save/update API")
		return
	if manager.has_method("delete_settings_file"):
		manager.call("delete_settings_file")

	var initial: Dictionary = manager.call("load_settings")
	if not initial.get("ok", false):
		_fail("Default settings load failed: %s" % str(initial.get("error", "")))
		return
	var defaults: Dictionary = manager.call("settings_snapshot")
	if bool(defaults.get("fullscreen", true)) or not is_equal_approx(float(defaults.get("ui_scale", 0)), 1.0):
		_fail("Default settings have unexpected values")
		return

	manager.call("update_setting", "fullscreen", true)
	manager.call("update_setting", "ui_scale", 1.25)
	manager.call("update_setting", "master_volume", 0.35)
	var save_result: Dictionary = manager.call("save_settings")
	if not save_result.get("ok", false):
		_fail("Settings save failed: %s" % str(save_result.get("error", "")))
		return

	var reloaded: RefCounted = SettingsManagerScript.new()
	var load_result: Dictionary = reloaded.call("load_settings")
	if not load_result.get("ok", false):
		_fail("Reloaded settings load failed: %s" % str(load_result.get("error", "")))
		return
	var snapshot: Dictionary = reloaded.call("settings_snapshot")
	if not bool(snapshot.get("fullscreen", false)):
		_fail("Fullscreen setting was not persisted")
		return
	if not is_equal_approx(float(snapshot.get("ui_scale", 0)), 1.25):
		_fail("UI scale setting was not persisted")
		return
	if not is_equal_approx(float(snapshot.get("master_volume", 0)), 0.35):
		_fail("Master volume setting was not persisted")
		return

	reloaded.call("delete_settings_file")
	print("[TianmingGodotTest] settings manager scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] settings manager scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] settings manager scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
