extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const MING_LIAODONG_REGION := "辽东（明）"

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

	_prepare_hostile_later_jin(state)
	_prepare_liaodong_region(state)
	var frontier_before: float = float(state.call("variable_value", "辽东防线稳固度"))
	var region_before: Dictionary = _region_by_name(_array(state.get("map_regions")), MING_LIAODONG_REGION)
	if region_before.is_empty():
		_fail("Scenario does not expose Ming Liaodong region")
		return
	var report: Dictionary = state.call("advance_month")
	var actions: Array = _array(report.get("faction_ai_actions", []))
	if actions.is_empty():
		_fail("Monthly settlement did not record hostile faction AI pressure")
		return
	var action: Dictionary = _dict(actions[0])
	if str(action.get("faction", "")) != "后金":
		_fail("Faction AI pressure did not identify Later Jin as actor")
		return
	if str(action.get("target_region", "")) != MING_LIAODONG_REGION:
		_fail("Faction AI pressure did not target Ming Liaodong")
		return

	var region_after: Dictionary = _region_by_name(_array(state.get("map_regions")), MING_LIAODONG_REGION)
	if float(state.call("variable_value", "辽东防线稳固度")) >= frontier_before:
		_fail("Hostile faction pressure did not reduce Liaodong frontier stability")
		return
	if int(region_after.get("army_pressure", 0)) <= int(region_before.get("army_pressure", 0)):
		_fail("Hostile faction pressure did not increase target region army pressure")
		return
	if int(region_after.get("unrest", 0)) <= int(region_before.get("unrest", 0)):
		_fail("Hostile faction pressure did not increase target region unrest")
		return

	print("[TianmingGodotTest] faction AI pressure scene test passed")
	_finish(0)

func _prepare_hostile_later_jin(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		if str(faction.get("name", "")) != "后金":
			continue
		faction["attitude"] = "敌对"
		faction["hostility"] = 92
		faction["border_tension"] = 88
		faction["military_strength"] = 320000
		rows[i] = faction
		break
	state.set("factions", rows)

func _prepare_liaodong_region(state: RefCounted) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(rows.size()):
		var region: Dictionary = _dict(rows[i]).duplicate(true)
		if str(region.get("name", "")) != MING_LIAODONG_REGION:
			continue
		region["army_pressure"] = 38
		region["unrest"] = 50
		region["mood"] = 45
		rows[i] = region
		break
	state.set("map_regions", rows)

func _region_by_name(regions: Array, region_name: String) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("name", "")) == region_name:
			return region
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction AI pressure scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
