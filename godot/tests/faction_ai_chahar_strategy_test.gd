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

	_prepare_later_jin_and_chahar(state)
	_prepare_chahar_region(state)
	var chahar_before: Dictionary = _faction_by_name(_array(state.get("factions")), "察哈尔")
	var region_before: Dictionary = _region_by_name(_array(state.get("map_regions")), "察哈尔")
	var report: Dictionary = state.call("advance_month")
	var action: Dictionary = _find_action(_array(report.get("faction_ai_actions", [])), "mongol_pressure")
	if action.is_empty():
		_fail("Later Jin did not choose a Chahar-facing pressure action")
		return
	if str(action.get("target_faction", "")) != "察哈尔":
		_fail("Mongol pressure did not target Chahar faction")
		return
	if str(action.get("target_region", "")) != "察哈尔":
		_fail("Mongol pressure did not target Chahar region")
		return

	var chahar_after: Dictionary = _faction_by_name(_array(state.get("factions")), "察哈尔")
	var region_after: Dictionary = _region_by_name(_array(state.get("map_regions")), "察哈尔")
	if int(chahar_after.get("cohesion", 0)) >= int(chahar_before.get("cohesion", 0)):
		_fail("Mongol pressure did not reduce Chahar cohesion")
		return
	if int(region_after.get("army_pressure", 0)) <= int(region_before.get("army_pressure", 0)):
		_fail("Mongol pressure did not increase Chahar regional army pressure")
		return

	print("[TianmingGodotTest] faction AI Chahar strategy scene test passed")
	_finish(0)

func _prepare_later_jin_and_chahar(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		match str(faction.get("name", "")):
			"后金":
				faction["attitude"] = "敌对"
				faction["hostility"] = 94
				faction["border_tension"] = 92
				faction["military_strength"] = 350000
			"察哈尔":
				faction["relation_to_player"] = 20
				faction["hostility"] = 15
				faction["military_strength"] = 70000
				faction["cohesion"] = 45
		rows[i] = faction
	state.set("factions", rows)

func _prepare_chahar_region(state: RefCounted) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(rows.size()):
		var region: Dictionary = _dict(rows[i]).duplicate(true)
		if str(region.get("name", "")) != "察哈尔":
			continue
		region["army_pressure"] = 35
		region["unrest"] = 45
		region["mood"] = 50
		rows[i] = region
		break
	state.set("map_regions", rows)

func _find_action(actions: Array, kind: String) -> Dictionary:
	for raw in actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("kind", "")) == kind:
			return action
	return {}

func _faction_by_name(factions: Array, faction_name: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("name", "")) == faction_name:
			return faction
	return {}

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
	print("[TianmingGodotTest] faction AI Chahar strategy scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
