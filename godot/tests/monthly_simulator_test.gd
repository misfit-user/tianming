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

	var summary: Dictionary = state.get("summary")
	var expected_guoku_money: float = maxf(0.0, float(state.get("guoku_money")) + float(summary.get("guoku_income_money", 0)) - float(summary.get("guoku_expense_money", 0)))
	var expected_guoku_grain: float = maxf(0.0, float(state.get("guoku_grain")) + float(summary.get("guoku_income_grain", 0)) - float(summary.get("guoku_expense_grain", 0)))
	var expected_neitang_money: float = maxf(0.0, float(state.get("neitang_money")) + float(summary.get("neitang_income_money", 0)) - float(summary.get("neitang_expense_money", 0)))
	var huangquan_before: float = float(state.get("huangquan"))

	var report: Dictionary = state.call("advance_month")
	if not bool(report.get("settled", false)):
		_fail("Monthly report was not marked as settled")
		return
	if not is_equal_approx(float(state.get("guoku_money")), expected_guoku_money):
		_fail("Unexpected guoku money after settlement")
		return
	if not is_equal_approx(float(state.get("guoku_grain")), expected_guoku_grain):
		_fail("Unexpected guoku grain after settlement")
		return
	if not is_equal_approx(float(state.get("neitang_money")), expected_neitang_money):
		_fail("Unexpected neitang money after settlement")
		return
	if not is_equal_approx(float(state.get("huangquan")), huangquan_before):
		_fail("Monthly settlement changed huangquan unexpectedly")
		return
	if int(state.get("turn")) != 2:
		_fail("Turn did not advance")
		return
	if int((state.get("turn_reports") as Array).size()) != 1:
		_fail("Turn report history was not recorded")
		return
	if (state.get("map_regions") as Array).is_empty():
		_fail("Runtime map regions are empty after settlement")
		return
	if (state.get("factions") as Array).is_empty():
		_fail("Runtime factions are empty after settlement")
		return

	print("[TianmingGodotTest] monthly simulator scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] monthly scene test exit_code=%d" % exit_code)
