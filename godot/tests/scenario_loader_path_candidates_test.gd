extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")

func _ready() -> void:
	var loader: RefCounted = ScenarioLoaderScript.new()
	if not loader.has_method("_scenario_dir_candidates"):
		_fail("ScenarioLoader does not expose scenario directory candidates")
		return
	if not loader.has_method("_find_official_tianqi_file_in_candidates"):
		_fail("ScenarioLoader does not search multiple scenario directories")
		return

	var candidates: PackedStringArray = loader.call("_scenario_dir_candidates")
	var original_dir: String = ProjectSettings.globalize_path("res://../scenarios")
	var copied_dir: String = ProjectSettings.globalize_path("res://../../scenarios")
	if not candidates.has(original_dir):
		_fail("ScenarioLoader candidates omitted original Godot sibling scenarios path")
		return
	if not candidates.has(copied_dir):
		_fail("ScenarioLoader candidates omitted copied web/godot scenarios fallback path")
		return

	var root: String = ProjectSettings.globalize_path("user://scenario_loader_path_candidates")
	var empty_dir: String = root.path_join("empty")
	var official_dir: String = root.path_join("official")
	var err_a: Error = DirAccess.make_dir_recursive_absolute(empty_dir)
	var err_b: Error = DirAccess.make_dir_recursive_absolute(official_dir)
	if err_a != OK or err_b != OK:
		_fail("Failed to prepare temporary scenario directories")
		return

	var official_path: String = official_dir.path_join("天启七年·九月（官方）.json")
	var file := FileAccess.open(official_path, FileAccess.WRITE)
	if file == null:
		_fail("Failed to write temporary official scenario JSON")
		return
	file.store_string("{}")
	file.close()

	var found: Dictionary = loader.call("_find_official_tianqi_file_in_candidates", PackedStringArray([empty_dir, official_dir]))
	if str(found.get("path", "")) != official_path:
		_fail("ScenarioLoader did not find official JSON in the later candidate directory")
		return
	if str(found.get("scenario_dir", "")) != official_dir:
		_fail("ScenarioLoader did not report the winning scenario directory")
		return

	print("[TianmingGodotTest] scenario loader path-candidates scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] scenario loader path-candidates scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] scenario loader path-candidates scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
