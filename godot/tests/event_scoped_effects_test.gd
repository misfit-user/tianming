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

	_prepare_faction_window(state, "后金")
	var region_before: Dictionary = _region_by_name(_array(state.get("map_regions")), "北直隶")
	var faction_before: Dictionary = state.call("faction_by_name", "后金")
	if region_before.is_empty() or faction_before.is_empty():
		_fail("Required region or faction was not loaded")
		return

	state.set("event_queue", [
		{
			"id": "test_scoped_event",
			"name": "Scoped Effect Test",
			"effect_data": {
				"treasury_money": -10000,
				"region_effects": {
					"北直隶": {
						"unrest": 6,
						"mood": -4
					}
				},
				"faction_effects": {
					"后金": {
						"hostility": 5,
						"relation_to_player": -8
					}
				}
			}
		}
	])

	var treasury_before: float = float(state.get("guoku_money"))
	var result: Dictionary = state.call("resolve_event", "test_scoped_event", -1)
	if not result.get("ok", false):
		_fail("Scoped event did not resolve: %s" % str(result.get("error", "")))
		return

	var region_after: Dictionary = _region_by_name(_array(state.get("map_regions")), "北直隶")
	var faction_after: Dictionary = state.call("faction_by_name", "后金")
	if float(state.get("guoku_money")) != treasury_before - 10000.0:
		_fail("Scoped event did not apply direct treasury effect")
		return
	if int(region_after.get("unrest", 0)) != int(region_before.get("unrest", 0)) + 6:
		_fail("Scoped event did not apply target region unrest effect")
		return
	if int(region_after.get("mood", 0)) != int(region_before.get("mood", 0)) - 4:
		_fail("Scoped event did not apply target region mood effect")
		return
	if int(faction_after.get("hostility", 0)) != int(faction_before.get("hostility", 0)) + 5:
		_fail("Scoped event did not apply target faction hostility effect")
		return
	if int(faction_after.get("relation_to_player", 0)) != int(faction_before.get("relation_to_player", 0)) - 8:
		_fail("Scoped event did not apply target faction relation effect")
		return

	var applied: Dictionary = _dict(result.get("applied", {}))
	if _array(applied.get("region_effects", [])).is_empty() or _array(applied.get("faction_effects", [])).is_empty():
		_fail("Scoped event did not report region and faction effects")
		return

	print("[TianmingGodotTest] event scoped effects scene test passed")
	_finish(0)

func _region_by_name(regions: Array, region_name: String) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("name", "")) == region_name:
			return region
	return {}

func _prepare_faction_window(state: RefCounted, faction_name: String) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		if str(faction.get("name", "")) != faction_name:
			continue
		faction["hostility"] = 40
		faction["relation_to_player"] = 50
		rows[i] = faction
		break
	state.set("factions", rows)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] event scoped effects scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
