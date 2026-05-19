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

	var setup: Dictionary = _force_garrison_fixture(state)
	if not setup.get("ok", false):
		_fail(str(setup.get("error", "fixture setup failed")))
		return
	var army_id: String = str(setup.get("army_id", ""))
	var region_id: String = str(setup.get("region_id", ""))
	var action_points_before: int = int(state.get("action_points"))
	var region_before: Dictionary = _region_by_id(_array(state.get("map_regions")), region_id)
	var army_before: Dictionary = _army_by_id(_array(state.get("armies")), army_id)
	var unrest_before: int = int(_num(region_before.get("unrest", 0)))
	var pressure_before: int = int(_num(region_before.get("army_pressure", 0)))
	var mood_before: int = int(_num(region_before.get("mood", 0)))
	var control_before: int = int(_num(army_before.get("control", army_before.get("control_level", 0))))

	var result: Dictionary = state.call("issue_army_action", "secure_garrison", army_id)
	if not result.get("ok", false):
		_fail("Garrison army action failed: %s" % str(result.get("error", "")))
		return

	var region_after: Dictionary = _region_by_id(_array(state.get("map_regions")), region_id)
	var army_after: Dictionary = _army_by_id(_array(state.get("armies")), army_id)
	if int(_num(region_after.get("unrest", 0))) >= unrest_before:
		_fail("Garrison army action did not reduce region unrest")
		return
	if int(_num(region_after.get("army_pressure", 0))) >= pressure_before:
		_fail("Garrison army action did not reduce region army pressure")
		return
	if int(_num(region_after.get("mood", 0))) <= mood_before:
		_fail("Garrison army action did not improve region mood")
		return
	if int(_num(army_after.get("control", army_after.get("control_level", 0)))) <= control_before:
		_fail("Garrison army action did not improve army control")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Garrison army action did not spend one action point")
		return
	var history: Array = _array(state.get("army_action_history"))
	if history.is_empty():
		_fail("Garrison army action did not record history")
		return
	var record: Dictionary = _dict(history[history.size() - 1])
	if str(record.get("target_region_id", "")) != region_id or _dict(record.get("region_applied", {})).is_empty():
		_fail("Garrison army action did not record target region effects")
		return

	var restored: RefCounted = GameStateScript.new()
	restored.call("load_from_scenario_result", load_result)
	var restore_result: Dictionary = restored.call("restore_save_snapshot", state.call("create_save_snapshot"))
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	var restored_region: Dictionary = _region_by_id(_array(restored.get("map_regions")), region_id)
	if int(_num(restored_region.get("unrest", 0))) != int(_num(region_after.get("unrest", 0))):
		_fail("Save/load did not preserve garrison region action result")
		return

	print("[TianmingGodotTest] army garrison action scene test passed")
	_finish(0)

func _force_garrison_fixture(state: RefCounted) -> Dictionary:
	var armies: Array = _array(state.get("armies")).duplicate(true)
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	if armies.is_empty() or regions.is_empty():
		return {"ok": false, "error": "not enough armies or regions"}
	var army: Dictionary = _dict(armies[0]).duplicate(true)
	var region: Dictionary = _dict(regions[0]).duplicate(true)
	army["garrison"] = str(region.get("name", ""))
	army["location"] = str(region.get("name", ""))
	army["control"] = 35
	army["control_level"] = 35
	region["unrest"] = 72
	region["army_pressure"] = 68
	region["mood"] = 35
	armies[0] = army
	regions[0] = region
	state.set("armies", armies)
	state.set("map_regions", regions)
	return {
		"ok": true,
		"army_id": str(army.get("id", "")),
		"region_id": str(region.get("id", ""))
	}

func _army_by_id(rows: Array, army_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == army_id:
			return row
	return {}

func _region_by_id(rows: Array, region_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == region_id:
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army garrison action scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
