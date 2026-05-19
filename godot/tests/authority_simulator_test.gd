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

	var huangquan_before: float = float(state.get("huangquan"))
	var huangwei_before: float = float(state.get("huangwei"))
	state.set("minxin", 18.0)
	state.call("set_variable_value", "流民数量", 6000000.0)
	state.call("set_variable_value", "辽饷积欠", 820.0)
	state.call("set_variable_value", "九边欠饷总数", 1260.0)
	state.call("set_variable_value", "辽东防线稳固度", 30.0)

	var regions: Array = (state.get("map_regions") as Array).duplicate(true)
	for i in range(regions.size()):
		var region: Dictionary = regions[i]
		var region_name: String = str(region.get("name", ""))
		if region_name in ["陕西", "河南", "山西", "山东", "北直隶"]:
			region["mood"] = 20
			region["unrest"] = 94
			region["tax_pressure"] = 80
			region["army_pressure"] = 58
			regions[i] = region
	state.set("map_regions", regions)

	var report: Dictionary = state.call("advance_month")
	if not is_equal_approx(float(state.get("huangquan")), huangquan_before):
		_fail("Huangquan changed from monthly military/local pressure")
		return
	if float(state.get("huangwei")) >= huangwei_before:
		_fail("Huangwei did not fall under uprising and frontier crisis")
		return
	if not report.has("huangwei_delta") or float(report.get("huangwei_delta")) >= 0.0:
		_fail("Monthly report did not record negative huangwei_delta")
		return
	if float(report.get("huangquan_delta", 999)) != 0.0:
		_fail("Monthly report changed huangquan_delta")
		return
	if (report.get("authority_reasons", []) as Array).is_empty():
		_fail("Monthly report did not include authority reasons")
		return

	print("[TianmingGodotTest] authority simulator scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] authority scene test exit_code=%d" % exit_code)
