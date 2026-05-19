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
	_prepare_vulnerable_liaodong(state)
	state.call("set_variable_value", "辽东防线稳固度", 24)
	var frontier_before: float = float(state.call("variable_value", "辽东防线稳固度"))
	var treasury_before: float = float(state.get("guoku_money"))
	var grain_before: float = float(state.get("guoku_grain"))
	var report: Dictionary = state.call("advance_month")

	var raid: Dictionary = _find_action(_array(report.get("faction_ai_actions", [])), "raid")
	if raid.is_empty():
		_fail("Hostile faction AI did not launch a raid when Liaodong frontier was weak")
		return
	if float(state.call("variable_value", "辽东防线稳固度")) >= frontier_before:
		_fail("Raid did not reduce Liaodong frontier stability")
		return
	if float(state.get("guoku_money")) >= treasury_before or float(state.get("guoku_grain")) >= grain_before:
		_fail("Raid did not damage treasury money and grain")
		return

	var pending: Array = _array(state.get("pending_court_recommendations"))
	var counterplay: Dictionary = _find_counterplay(pending, str(raid.get("id", "")))
	if counterplay.is_empty():
		_fail("Raid did not create a player counterplay recommendation")
		return

	var target_region_name: String = str(raid.get("target_region", MING_LIAODONG_REGION))
	var region_before_counter: Dictionary = _region_by_name(_array(state.get("map_regions")), target_region_name)
	if region_before_counter.is_empty():
		_fail("Raid target region was not found before counterplay: %s" % target_region_name)
		return
	var frontier_after_raid: float = float(state.call("variable_value", "辽东防线稳固度"))
	var enact_result: Dictionary = state.call("enact_court_recommendation", str(counterplay.get("id", "")))
	if not enact_result.get("ok", false):
		_fail("Counterplay recommendation failed: %s" % str(enact_result.get("error", "")))
		return
	var region_after_counter: Dictionary = _region_by_name(_array(state.get("map_regions")), target_region_name)
	if float(state.call("variable_value", "辽东防线稳固度")) <= frontier_after_raid:
		_fail("Counterplay did not restore Liaodong frontier stability")
		return
	if int(region_after_counter.get("army_pressure", 0)) >= int(region_before_counter.get("army_pressure", 0)):
		_fail("Counterplay did not reduce Liaodong army pressure")
		return

	print("[TianmingGodotTest] faction AI raid counterplay scene test passed")
	_finish(0)

func _prepare_hostile_later_jin(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		if str(faction.get("name", "")) != "后金":
			continue
		faction["attitude"] = "敌对"
		faction["hostility"] = 96
		faction["border_tension"] = 95
		faction["military_strength"] = 360000
		rows[i] = faction
		break
	state.set("factions", rows)

func _prepare_vulnerable_liaodong(state: RefCounted) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(rows.size()):
		var region: Dictionary = _dict(rows[i]).duplicate(true)
		if str(region.get("name", "")) != MING_LIAODONG_REGION:
			continue
		region["army_pressure"] = 68
		region["unrest"] = 58
		region["mood"] = 42
		rows[i] = region
		break
	state.set("map_regions", rows)

func _find_action(actions: Array, kind: String) -> Dictionary:
	for raw in actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("kind", "")) == kind:
			return action
	return {}

func _find_counterplay(recommendations: Array, source_action_id: String) -> Dictionary:
	for raw in recommendations:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("source_faction_action_id", "")) == source_action_id and str(recommendation.get("category", "")) == "军务":
			return recommendation
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
	print("[TianmingGodotTest] faction AI raid counterplay scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
