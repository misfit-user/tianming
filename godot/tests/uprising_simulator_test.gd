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

	state.set("minxin", 18.0)
	state.call("set_variable_value", "流民数量", 6000000.0)
	var regions: Array = (state.get("map_regions") as Array).duplicate(true)
	for i in range(regions.size()):
		var region: Dictionary = regions[i]
		var region_name: String = str(region.get("name", ""))
		if region_name in ["陕西", "河南", "山西", "山东", "北直隶"]:
			region["mood"] = 22
			region["unrest"] = 92
			region["tax_pressure"] = 78
			region["army_pressure"] = 52
			regions[i] = region
	state.set("map_regions", regions)

	var before_count: int = _uprising_count(state.get("factions") as Array)
	var report: Dictionary = state.call("advance_month")
	var after_count: int = _uprising_count(state.get("factions") as Array)
	if after_count <= before_count:
		_fail("High uprising pressure did not create a new uprising faction")
		return
	if not bool(report.get("uprising_created", false)):
		_fail("Monthly report did not mark uprising_created")
		return
	if (report.get("uprisings", []) as Array).is_empty():
		_fail("Monthly report did not include uprising details")
		return

	print("[TianmingGodotTest] uprising simulator scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] uprising scene test exit_code=%d" % exit_code)

func _uprising_count(factions: Array) -> int:
	var count: int = 0
	for raw in factions:
		var faction: Dictionary = raw if typeof(raw) == TYPE_DICTIONARY else {}
		if str(faction.get("id", "")).begins_with("runtime-uprising-"):
			count += 1
	return count
