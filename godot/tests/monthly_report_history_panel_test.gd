extends Node

const MonthlyReportPanelScript := preload("res://scripts/monthly_report_panel.gd")

func _ready() -> void:
	var panel: Control = MonthlyReportPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	if not panel.has_method("set_reports") or not panel.has_method("select_report") or not panel.has_method("visible_text"):
		_fail("Monthly report panel does not expose report-history APIs")
		return

	panel.call("set_reports", [
		_report(1, 1627, 9, -100000.0, -1.0),
		_report(2, 1627, 10, 50000.0, 2.0)
	])
	panel.call("select_report", 1)
	var first_text: String = str(panel.call("visible_text"))
	if not first_text.contains("1627年9月") or first_text.contains("1627年10月"):
		_fail("Selecting the first monthly report did not update visible text")
		return
	panel.call("select_report", 2)
	var second_text: String = str(panel.call("visible_text"))
	if not second_text.contains("1627年10月") or second_text.contains("1627年9月"):
		_fail("Selecting the second monthly report did not update visible text")
		return

	print("[TianmingGodotTest] monthly report history panel scene test passed")
	_finish(0)

func _report(turn: int, year: int, month: int, money_delta: float, huangwei_delta: float) -> Dictionary:
	return {
		"settled": true,
		"turn": turn,
		"year": year,
		"month": month,
		"guoku_money_delta": money_delta,
		"guoku_grain_delta": 0,
		"neitang_money_delta": 0,
		"liao_arrears_delta": 0,
		"jiubian_arrears_delta": 0,
		"liaodong_frontier_delta": 0,
		"ming_military_cohesion_delta": 0,
		"huangquan_delta": 0,
		"huangwei_delta": huangwei_delta,
		"authority_reasons": [],
		"population_registered_delta": 0,
		"population_hidden_delta": 0,
		"refugee_delta": 0,
		"minxin_delta": 0,
		"avg_region_mood": 50,
		"avg_region_unrest": 10,
		"high_unrest_regions": 0,
		"worsened_regions": 0,
		"events": [],
		"uprisings": [],
		"faction_ai_actions": [],
		"military_alerts": [],
		"region_changes": []
	}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] monthly report history panel scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] monthly report history panel scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
