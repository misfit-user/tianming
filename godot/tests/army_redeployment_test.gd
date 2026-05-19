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

	var setup: Dictionary = _force_fixture_locations(state)
	if not setup.get("ok", false):
		_fail(str(setup.get("error", "fixture setup failed")))
		return

	var army_id: String = str(setup.get("army_id", ""))
	var source_id: String = str(setup.get("source_id", ""))
	var target_id: String = str(setup.get("target_id", ""))
	var target_name: String = str(setup.get("target_name", ""))
	var action_points_before: int = int(state.get("action_points"))

	var result: Dictionary = state.call("redeploy_army", army_id, target_id)
	if not result.get("ok", false):
		_fail("Army redeployment failed: %s" % str(result.get("error", "")))
		return

	var updated_army: Dictionary = _army_by_id(_array(state.get("armies")), army_id)
	if str(updated_army.get("garrison", "")) != target_name or str(updated_army.get("location", "")) != target_name:
		_fail("Army redeployment did not update army location")
		return
	var source_region: Dictionary = _region_by_id(_array(state.get("map_regions")), source_id)
	var target_region: Dictionary = _region_by_id(_array(state.get("map_regions")), target_id)
	if int(_num(source_region.get("troops", 0))) >= 10000:
		_fail("Army redeployment did not reduce source-region troops")
		return
	if int(_num(target_region.get("troops", 0))) <= 2000:
		_fail("Army redeployment did not increase target-region troops")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Army redeployment did not spend one action point")
		return
	if _array(state.get("army_redeployment_history")).is_empty():
		_fail("Army redeployment did not record history")
		return

	var restored: RefCounted = GameStateScript.new()
	restored.call("load_from_scenario_result", load_result)
	var restore_result: Dictionary = restored.call("restore_save_snapshot", state.call("create_save_snapshot"))
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	var restored_army: Dictionary = _army_by_id(_array(restored.get("armies")), army_id)
	if str(restored_army.get("garrison", "")) != target_name or _array(restored.get("army_redeployment_history")).is_empty():
		_fail("Save/load did not preserve army redeployment")
		return

	print("[TianmingGodotTest] army redeployment scene test passed")
	_finish(0)

func _force_fixture_locations(state: RefCounted) -> Dictionary:
	var armies: Array = _array(state.get("armies")).duplicate(true)
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	if armies.is_empty() or regions.size() < 2:
		return {"ok": false, "error": "not enough armies or regions"}
	var army: Dictionary = _dict(armies[0]).duplicate(true)
	var source: Dictionary = _dict(regions[0]).duplicate(true)
	var target: Dictionary = _dict(regions[1]).duplicate(true)
	army["garrison"] = str(source.get("name", ""))
	army["location"] = str(source.get("name", ""))
	army["soldiers"] = 5000
	army["soldiers_text"] = "5000人"
	source["troops"] = 10000
	target["troops"] = 2000
	armies[0] = army
	regions[0] = source
	regions[1] = target
	state.set("armies", armies)
	state.set("map_regions", regions)
	return {
		"ok": true,
		"army_id": str(army.get("id", "")),
		"source_id": str(source.get("id", "")),
		"target_id": str(target.get("id", "")),
		"target_name": str(target.get("name", ""))
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
	print("[TianmingGodotTest] army redeployment scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
