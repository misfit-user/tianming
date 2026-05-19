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

	var region_id: String = "uprising-control-region"
	var region_name: String = "Uprising Control Region"
	state.set("minxin", 8.0)
	state.call("set_variable_value", "流民数量", 9000000.0)
	_append_uprising_region(state, region_id, region_name)

	var report: Dictionary = state.call("advance_month")
	var uprisings: Array = _array(report.get("uprisings", []))
	if uprisings.is_empty():
		_fail("High uprising pressure did not create uprising report details")
		return
	var uprising: Dictionary = _dict(uprisings[0])
	var uprising_id: String = str(uprising.get("id", ""))
	if uprising_id.is_empty() or str(uprising.get("region_id", "")) != region_id:
		_fail("Uprising report did not identify the controlled region")
		return
	var updated_region: Dictionary = state.call("region_by_id", region_id)
	if str(updated_region.get("controller_id", "")) != uprising_id:
		_fail("Uprising did not take control of its outbreak region")
		return
	if str(updated_region.get("controller", "")) != str(uprising.get("name", "")):
		_fail("Uprising region controller name was not updated")
		return
	if str(updated_region.get("owner", "")).is_empty():
		_fail("Uprising control removed the region owner instead of only changing controller")
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
	var restored_region: Dictionary = restored.call("region_by_id", region_id)
	if str(restored_region.get("controller_id", "")) != uprising_id:
		_fail("Restored state lost uprising region controller")
		return

	print("[TianmingGodotTest] uprising region control scene test passed")
	_finish(0)

func _append_uprising_region(state: RefCounted, region_id: String, region_name: String) -> void:
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(regions.size()):
		var existing: Dictionary = _dict(regions[i]).duplicate(true)
		existing["mood"] = 80
		existing["unrest"] = 5
		existing["tax_pressure"] = 5
		existing["army_pressure"] = 5
		regions[i] = existing
	if not regions.is_empty():
		var secondary: Dictionary = _dict(regions[0]).duplicate(true)
		secondary["mood"] = 20
		secondary["unrest"] = 82
		secondary["tax_pressure"] = 65
		secondary["army_pressure"] = 35
		regions[0] = secondary
	regions.append({
		"id": region_id,
		"name": region_name,
		"owner_id": "ming",
		"owner": "大明",
		"controller_id": "ming",
		"controller": "大明",
		"terrain": "旱塬",
		"resources": [],
		"development": 18,
		"prosperity": 12,
		"troops": 800,
		"mood": 1,
		"unrest": 100,
		"tax_pressure": 100,
		"army_pressure": 80,
		"neighbors": [],
		"prefectures": [],
		"prefecture_count": 0
	})
	state.set("map_regions", regions)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] uprising region control scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] uprising region control scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
