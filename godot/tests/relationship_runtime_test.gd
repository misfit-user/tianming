extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return

	var character_relations: Array = _array(state.get("character_relations"))
	var faction_relations: Array = _array(state.get("faction_relations"))
	if character_relations.size() < 50:
		_fail("Runtime state did not load top-level character relations")
		return
	if faction_relations.size() < 40:
		_fail("Runtime state did not load top-level faction relations")
		return
	if not state.has_method("relationship_rows"):
		_fail("Runtime state does not expose relationship rows")
		return
	var rows: Dictionary = state.call("relationship_rows")
	if _array(rows.get("characters", [])).size() != character_relations.size():
		_fail("Relationship rows did not expose all character relations")
		return
	if _array(rows.get("factions", [])).size() != faction_relations.size():
		_fail("Relationship rows did not expose all faction relations")
		return

	var snapshot: Dictionary = state.call("create_save_snapshot")
	var restored: RefCounted = GameStateScript.new()
	var restored_init: Dictionary = restored.call("load_from_scenario_result", load_result)
	if not restored_init.get("ok", false):
		_fail("Restored state init failed: %s" % str(restored_init.get("error", "")))
		return
	var restore_result: Dictionary = restored.call("restore_save_snapshot", snapshot)
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	if _array(restored.get("character_relations")).size() != character_relations.size():
		_fail("Save restore lost character relations")
		return
	if _array(restored.get("faction_relations")).size() != faction_relations.size():
		_fail("Save restore lost faction relations")
		return

	print("[TianmingGodotTest] relationship runtime scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	print("[TianmingGodotTest] relationship runtime scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] relationship runtime scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
