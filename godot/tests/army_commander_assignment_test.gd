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

	var army: Dictionary = _army_by_name(_array(state.get("armies")), "关宁军主力")
	var candidate: Dictionary = _character_by_name(_array(state.get("characters")), "孙承宗")
	if army.is_empty() or candidate.is_empty():
		_fail("Fixture army or commander candidate is missing")
		return

	var action_points_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("appoint_army_commander", str(army.get("id", "")), str(candidate.get("id", "")))
	if not result.get("ok", false):
		_fail("Army commander assignment failed: %s" % str(result.get("error", "")))
		return

	var updated: Dictionary = _army_by_id(_array(state.get("armies")), str(army.get("id", "")))
	if str(updated.get("commander", "")) != "孙承宗":
		_fail("Army commander assignment did not update commander name")
		return
	if str(updated.get("commander_id", "")) != str(candidate.get("id", "")):
		_fail("Army commander assignment did not store commander id")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Army commander assignment did not spend one action point")
		return
	if _array(state.get("army_command_history")).is_empty():
		_fail("Army commander assignment did not record command history")
		return

	var restored: RefCounted = GameStateScript.new()
	restored.call("load_from_scenario_result", load_result)
	var restore_result: Dictionary = restored.call("restore_save_snapshot", state.call("create_save_snapshot"))
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	var restored_army: Dictionary = _army_by_id(_array(restored.get("armies")), str(army.get("id", "")))
	if str(restored_army.get("commander", "")) != "孙承宗" or _array(restored.get("army_command_history")).is_empty():
		_fail("Save/load did not preserve army commander assignment")
		return

	print("[TianmingGodotTest] army commander assignment scene test passed")
	_finish(0)

func _army_by_name(rows: Array, army_name: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("name", "")) == army_name:
			return row
	return {}

func _army_by_id(rows: Array, army_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == army_id:
			return row
	return {}

func _character_by_name(rows: Array, character_name: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("name", "")) == character_name:
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army commander assignment scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
