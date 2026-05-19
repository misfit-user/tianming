extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	if not _verify_frontier_pressure(load_result):
		return
	if not _verify_relief_pressure(load_result):
		return

	print("[TianmingGodotTest] court meeting agenda full-pressure scene test passed")
	_finish(0)

func _verify_frontier_pressure(load_result: Dictionary) -> bool:
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return false

	_inject_frontier_regions(state, 4)
	var meeting_result: Dictionary = state.call("hold_court_meeting", "frontier_council", _prepare_strong_participants(state))
	if not meeting_result.get("ok", false):
		_fail("Court meeting failed: %s" % str(meeting_result.get("error", "")))
		return false

	var agenda_pressure: Array = _array(_dict(meeting_result.get("record", {})).get("agenda_pressure", []))
	var recommendations: Array = _array(state.get("pending_court_recommendations"))
	for i in range(4):
		var region_id: String = "test_frontier_%d" % i
		if _find_agenda_pressure(agenda_pressure, region_id).is_empty():
			_fail("Frontier agenda pressure omitted pressured region: %s" % region_id)
			return false
		if _find_region_recommendation(recommendations, region_id).is_empty():
			_fail("Frontier agenda recommendation omitted pressured region: %s" % region_id)
			return false
	return true

func _verify_relief_pressure(load_result: Dictionary) -> bool:
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return false

	_inject_relief_regions(state, 4)
	var meeting_result: Dictionary = state.call("hold_court_meeting", "relief_council", _prepare_strong_participants(state))
	if not meeting_result.get("ok", false):
		_fail("Relief court meeting failed: %s" % str(meeting_result.get("error", "")))
		return false

	var agenda_pressure: Array = _array(_dict(meeting_result.get("record", {})).get("agenda_pressure", []))
	var recommendations: Array = _array(state.get("pending_court_recommendations"))
	for i in range(4):
		var region_id: String = "test_relief_%d" % i
		if _find_agenda_pressure(agenda_pressure, region_id).is_empty():
			_fail("Relief agenda pressure omitted pressured region: %s" % region_id)
			return false
		if _find_region_recommendation(recommendations, region_id).is_empty():
			_fail("Relief agenda recommendation omitted pressured region: %s" % region_id)
			return false
	return true

func _inject_frontier_regions(state: RefCounted, count: int) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(count):
		rows.append({
			"id": "test_frontier_%d" % i,
			"name": "Test Frontier %d" % i,
			"owner": "Ming",
			"controller": "Ming",
			"terrain": "frontier",
			"prosperity": 42,
			"mood": 38,
			"unrest": 60 + i,
			"army_pressure": 90 + i,
			"tax_pressure": 45,
			"troops": 12000 + i,
		})
	state.set("map_regions", rows)

func _inject_relief_regions(state: RefCounted, count: int) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(count):
		rows.append({
			"id": "test_relief_%d" % i,
			"name": "Test Relief %d" % i,
			"owner": "Ming",
			"controller": "Ming",
			"terrain": "plain",
			"prosperity": 30,
			"mood": 22 + i,
			"unrest": 82 + i,
			"army_pressure": 25,
			"tax_pressure": 65,
			"troops": 3000 + i,
		})
	state.set("map_regions", rows)

func _prepare_strong_participants(state: RefCounted) -> Array:
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
		character["administration"] = 92
		character["management"] = 90
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

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court meeting agenda full-pressure scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting agenda full-pressure scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
