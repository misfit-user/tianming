extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const MonthlySimulatorScript := preload("res://scripts/monthly_simulator.gd")

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

	var regions: Array = []
	for i in range(9):
		regions.append({
			"id": "stress_region_%02d" % i,
			"name": "压力地块%02d" % i,
			"prefecture_count": 1,
			"prosperity": 20,
			"mood": 40,
			"unrest": 65,
			"tax_pressure": 90,
			"army_pressure": 85
		})
	state.set("map_regions", regions)
	state.set("factions", [])
	state.set("event_deck", [])

	var simulator: RefCounted = MonthlySimulatorScript.new()
	var report: Dictionary = simulator.call("preview_month", state)
	var changes: Array = _array(report.get("region_changes", []))
	if changes.size() != regions.size():
		_fail("Monthly region changes were truncated: got %d expected %d" % [
			changes.size(),
			regions.size()
		])
		return
	for raw_region in regions:
		var region_name: String = str(_dict(raw_region).get("name", ""))
		if not _has_change_named(changes, region_name):
			_fail("Monthly region changes omitted %s" % region_name)
			return

	print("[TianmingGodotTest] monthly region changes full summary scene test passed")
	_finish(0)

func _has_change_named(changes: Array, region_name: String) -> bool:
	for raw in changes:
		var change: Dictionary = _dict(raw)
		if str(change.get("name", "")) == region_name:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] monthly region changes full summary scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] monthly region changes full summary scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
