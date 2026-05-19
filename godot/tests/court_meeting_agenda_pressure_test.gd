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

	_inject_frontier_pressure(state)
	var participant_ids: Array = _prepare_frontier_participants(state)
	var meeting_result: Dictionary = state.call("hold_court_meeting", "frontier_council", participant_ids)
	if not meeting_result.get("ok", false):
		_fail("Court meeting failed: %s" % str(meeting_result.get("error", "")))
		return

	var record: Dictionary = _dict(meeting_result.get("record", {}))
	var agenda_pressure: Array = _array(record.get("agenda_pressure", []))
	if agenda_pressure.is_empty():
		_fail("Frontier meeting did not record agenda pressure from a pressured region")
		return
	var pressure: Dictionary = _find_agenda_pressure(agenda_pressure, "test_frontier")
	if pressure.is_empty():
		_fail("Agenda pressure did not point at the high-pressure frontier region")
		return

	var recommendation: Dictionary = _find_region_recommendation(_array(state.get("pending_court_recommendations")), "test_frontier")
	if recommendation.is_empty():
		_fail("Frontier meeting did not create a region-specific follow-up recommendation")
		return
	var region_effects: Dictionary = _dict(recommendation.get("region_effects", {}))
	if not region_effects.has("test_frontier"):
		_fail("Region-specific recommendation does not target the pressured region")
		return

	var before_pressure: float = _region_field(state, "test_frontier", "army_pressure")
	var enact_result: Dictionary = state.call("enact_court_recommendation", str(recommendation.get("id", "")))
	if not enact_result.get("ok", false):
		_fail("Region-specific recommendation could not be enacted: %s" % str(enact_result.get("error", "")))
		return
	var after_pressure: float = _region_field(state, "test_frontier", "army_pressure")
	if after_pressure >= before_pressure:
		_fail("Enacted region-specific recommendation did not reduce army pressure")
		return

	print("[TianmingGodotTest] court meeting agenda pressure scene test passed")
	_finish(0)

func _inject_frontier_pressure(state: RefCounted) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	rows.append({
		"id": "test_frontier",
		"name": "Test Frontier",
		"owner": "Ming",
		"controller": "Ming",
		"terrain": "frontier",
		"prosperity": 42,
		"mood": 38,
		"unrest": 64,
		"army_pressure": 100,
		"tax_pressure": 45,
		"troops": 12000
	})
	state.set("map_regions", rows)

func _prepare_frontier_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["military"] = 92
		character["valor"] = 88
		character["intelligence"] = 84
		character["loyalty"] = 78
		rows[i] = character
		ids.append(id)
		if ids.size() >= 3:
			break
	state.set("characters", rows)
	return ids

func _find_region_recommendation(rows: Array, target_region_id: String) -> Dictionary:
	for raw in rows:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("target_region_id", "")) == target_region_id:
			return recommendation
	return {}

func _find_agenda_pressure(rows: Array, target_region_id: String) -> Dictionary:
	for raw in rows:
		var pressure: Dictionary = _dict(raw)
		if str(pressure.get("target_region_id", "")) == target_region_id:
			return pressure
	return {}

func _region_field(state: RefCounted, region_id: String, field: String) -> float:
	for raw in _array(state.get("map_regions")):
		var region: Dictionary = _dict(raw)
		if str(region.get("id", "")) == region_id:
			return float(region.get(field, 0))
	return 0.0

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting agenda pressure scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
