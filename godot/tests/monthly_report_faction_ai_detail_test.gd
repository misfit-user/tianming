extends Node

const MonthlyReportPanelScript := preload("res://scripts/monthly_report_panel.gd")

func _ready() -> void:
	var panel: Control = MonthlyReportPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	panel.call("set_report", {
		"settled": true,
		"turn": 1,
		"year": 1627,
		"month": 9,
		"guoku_money_delta": 0,
		"guoku_grain_delta": 0,
		"neitang_money_delta": 0,
		"liao_arrears_delta": 0,
		"jiubian_arrears_delta": 0,
		"liaodong_frontier_delta": 0,
		"ming_military_cohesion_delta": 0,
		"huangquan_delta": 0,
		"huangwei_delta": 0,
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
		"military_alerts": [],
		"region_changes": [],
		"faction_ai_actions": [
			{
				"kind": "chahar_counterpressure",
				"faction": "察哈尔",
				"target_faction": "后金",
				"border_tension_delta": -8,
				"reason": "明廷援察哈尔牵制后金北翼"
			},
			{
				"kind": "diplomatic_retaliation",
				"faction": "后金",
				"target_region": "辽东",
				"border_tension_delta": 4,
				"reason": "记恨毁约，借边事施压"
			},
			{
				"kind": "alliance_shift",
				"faction": "察哈尔",
				"target_faction": "察哈尔",
				"leaning_to": "后金",
				"relation_delta": -6,
				"hostility_delta": 5,
				"reason": "后金压迫与明廷关系低落，察哈尔出现倒向后金之势"
			}
		]
	})

	var text: String = str(panel.call("visible_text"))
	if not text.contains("明廷援察哈尔牵制后金北翼"):
		_fail("Monthly report omitted Chahar counterpressure reason")
		return
	if not text.contains("记恨毁约"):
		_fail("Monthly report omitted diplomatic retaliation reason")
		return
	if not text.contains("倒向后金") or not text.contains("对明关系"):
		_fail("Monthly report omitted alliance-shift target details")
		return

	print("[TianmingGodotTest] monthly report faction AI detail scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] monthly report faction AI detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] monthly report faction AI detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
