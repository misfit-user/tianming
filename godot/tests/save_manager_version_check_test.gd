extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const SaveManagerScript := preload("res://scripts/save_manager.gd")

var save_manager: RefCounted
var slot_id: String = "codex_old_version"

func _ready() -> void:
	save_manager = SaveManagerScript.new()
	save_manager.call("delete_slot", slot_id)
	_write_legacy_save(slot_id)

	var metadata: Dictionary = save_manager.call("slot_metadata", slot_id)
	if not bool(metadata.get("exists", false)):
		_fail("Legacy save metadata did not report the slot as existing")
		return
	if not metadata.has("compatible"):
		_fail("Save metadata does not include a compatibility flag")
		return
	if bool(metadata.get("compatible", true)):
		_fail("Legacy save metadata did not mark the old format as incompatible")
		return
	if str(metadata.get("format", "")) != "tianming-godot-save-v0":
		_fail("Legacy save metadata did not expose the source format")
		return

	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return
	var turn_before: int = int(state.get("turn"))
	var restore_result: Dictionary = save_manager.call("restore_slot", state, slot_id)
	if bool(restore_result.get("ok", false)):
		_fail("Restore unexpectedly accepted an incompatible save format")
		return
	if int(state.get("turn")) != turn_before:
		_fail("Failed incompatible restore mutated the runtime state")
		return

	save_manager.call("delete_slot", slot_id)
	print("[TianmingGodotTest] save manager version check scene test passed")
	_finish(0)

func _write_legacy_save(id: String) -> void:
	var dir_path: String = ProjectSettings.globalize_path("user://saves")
	DirAccess.make_dir_recursive_absolute(dir_path)
	var file_path: String = "%s/%s.json" % [dir_path, id]
	var file: FileAccess = FileAccess.open(file_path, FileAccess.WRITE)
	var snapshot: Dictionary = {
		"format": "tianming-godot-save-v0",
		"slot_id": id,
		"scenario_name": "Legacy Scenario",
		"saved_at_unix": 1000.0,
		"state": {
			"turn": 9,
			"year": 1620,
			"month": 3,
		}
	}
	file.store_string(JSON.stringify(snapshot, "\t"))
	file.close()

func _fail(message: String) -> void:
	if save_manager != null:
		save_manager.call("delete_slot", slot_id)
	print("[TianmingGodotTest] save manager version check scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save manager version check scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
