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

	var target_index: int = _first_faction_index(_array(state.get("factions")))
	if target_index < 0:
		_fail("No faction available for territory summary test")
		return
	var target: Dictionary = _dict(_array(state.get("factions"))[target_index])
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", target_id))
	var injected_names: Array = _append_owned_regions(state, target_id, target_name, 8)

	state.call("_refresh_faction_territory_summary", target_index)
	var refreshed: Dictionary = state.call("faction_by_id", target_id)
	var territory_text: String = str(refreshed.get("territory", ""))
	for raw in injected_names:
		var region_name: String = str(raw)
		if not territory_text.contains(region_name):
			_fail("Faction territory summary omitted controlled region: %s" % region_name)
			return

	print("[TianmingGodotTest] faction territory full-summary scene test passed")
	_finish(0)

func _append_owned_regions(state: RefCounted, faction_id: String, faction_name: String, count: int) -> Array:
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	var names: Array = []
	for i in range(1, count + 1):
		var region_name: String = "Test Territory %02d" % i
		names.append(region_name)
		regions.append({
			"id": "test_territory_%02d" % i,
			"name": region_name,
			"owner_id": faction_id,
			"owner": faction_name,
			"controller_id": faction_id,
			"controller": faction_name,
			"terrain": "plain",
			"resources": [],
			"development": 30,
			"prosperity": 35,
			"troops": 1000,
			"mood": 50,
			"unrest": 20,
			"tax_pressure": 20,
			"army_pressure": 20,
			"neighbors": [],
			"prefectures": [],
			"prefecture_count": 0,
		})
	state.set("map_regions", regions)
	return names

func _first_faction_index(factions: Array) -> int:
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i])
		if not str(faction.get("id", "")).is_empty():
			return i
	return -1

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction territory full-summary scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction territory full-summary scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
