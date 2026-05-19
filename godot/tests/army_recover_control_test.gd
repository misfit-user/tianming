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

	var setup: Dictionary = _force_enemy_control_fixture(state)
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

	var result: Dictionary = state.call("issue_army_action", "recover_garrison_control", army_id)
	if not result.get("ok", false):
		_fail("Recover garrison control action failed: %s" % str(result.get("error", "")))
		return

	var region_after: Dictionary = _region_by_id(_array(state.get("map_regions")), region_id)
	var army_after: Dictionary = _army_by_id(_array(state.get("armies")), army_id)
	if str(region_after.get("owner_id", "")) != "ming" or str(region_after.get("owner", "")) != "大明":
		_fail("Recover control action changed legal owner")
		return
	if str(region_after.get("controller_id", "")) != "ming" or str(region_after.get("controller", "")) != "大明":
		_fail("Recover control action did not restore controller to legal owner")
		return
	if int(_num(region_after.get("unrest", 0))) >= unrest_before:
		_fail("Recover control action did not reduce region unrest")
		return
	if int(_num(region_after.get("army_pressure", 0))) >= pressure_before:
		_fail("Recover control action did not reduce region army pressure")
		return
	if int(_num(region_after.get("mood", 0))) <= mood_before:
		_fail("Recover control action did not improve region mood")
		return
	if int(_num(army_after.get("control", army_after.get("control_level", 0)))) <= control_before:
		_fail("Recover control action did not improve army control")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Recover control action did not spend one action point")
		return

	var record: Dictionary = _dict(result.get("record", {}))
	var region_control: Dictionary = _dict(record.get("region_control", {}))
	if region_control.is_empty():
		_fail("Recover control action did not record control transfer details")
		return
	if str(region_control.get("before_controller_id", "")) != "uprising-test":
		_fail("Recover control history lost previous controller id")
		return
	if str(region_control.get("after_controller_id", "")) != "ming":
		_fail("Recover control history did not record restored controller id")
		return
	if str(record.get("target_region_id", "")) != region_id or _dict(record.get("region_applied", {})).is_empty():
		_fail("Recover control action did not record target region effects")
		return

	var restored: RefCounted = GameStateScript.new()
	restored.call("load_from_scenario_result", load_result)
	var restore_result: Dictionary = restored.call("restore_save_snapshot", state.call("create_save_snapshot"))
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	var restored_region: Dictionary = _region_by_id(_array(restored.get("map_regions")), region_id)
	if str(restored_region.get("controller_id", "")) != "ming":
		_fail("Save/load did not preserve recovered region controller")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "army_action"):
		_fail("Recover control action did not enter chronicle entries")
		return

	print("[TianmingGodotTest] army recover control scene test passed")
	_finish(0)

func _force_enemy_control_fixture(state: RefCounted) -> Dictionary:
	var armies: Array = _array(state.get("armies")).duplicate(true)
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	if armies.is_empty() or regions.is_empty():
		return {"ok": false, "error": "not enough armies or regions"}
	var army: Dictionary = _dict(armies[0]).duplicate(true)
	var region: Dictionary = _dict(regions[0]).duplicate(true)
	var region_id: String = str(region.get("id", "recover-control-region"))
	var region_name: String = str(region.get("name", "Recover Control Region"))
	army["garrison"] = region_name
	army["location"] = region_name
	army["region_id"] = region_id
	army["control"] = 42
	army["control_level"] = 42
	region["id"] = region_id
	region["name"] = region_name
	region["owner_id"] = "ming"
	region["owner"] = "大明"
	region["controller_id"] = "uprising-test"
	region["controller"] = "测试叛军"
	region["unrest"] = 88
	region["army_pressure"] = 76
	region["mood"] = 18
	armies[0] = army
	regions[0] = region
	state.set("armies", armies)
	state.set("map_regions", regions)
	return {
		"ok": true,
		"army_id": str(army.get("id", "")),
		"region_id": region_id
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

func _has_kind(entries: Array, kind: String) -> bool:
	for raw in entries:
		if str(_dict(raw).get("kind", "")) == kind:
			return true
	return false

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
	print("[TianmingGodotTest] army recover control scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
