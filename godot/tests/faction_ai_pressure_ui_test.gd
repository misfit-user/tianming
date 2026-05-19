extends Node

const MonthlyReportPanelScript := preload("res://scripts/monthly_report_panel.gd")

func _ready() -> void:
	var panel: PanelContainer = MonthlyReportPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_report", {
		"settled": true,
		"year": 1627,
		"month": 9,
		"faction_ai_actions": [
			{
				"faction": "后金",
				"target_region": "辽东（明·关宁东江）",
				"pressure": 5.0,
				"frontier_delta": -2.0
			}
		]
	})
	var alerts_label: Label = panel.get("alerts_label") as Label
	if alerts_label == null:
		_fail("Monthly report panel does not expose alerts label")
		return
	if not alerts_label.text.contains("后金") or not alerts_label.text.contains("辽东"):
		_fail("Monthly report panel did not display faction AI pressure")
		return

	print("[TianmingGodotTest] faction AI pressure UI scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction AI pressure UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
