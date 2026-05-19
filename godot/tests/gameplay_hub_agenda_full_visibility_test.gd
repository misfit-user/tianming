extends Node

const GameplayHubPanelScript := preload("res://scripts/gameplay_hub_panel.gd")

func _ready() -> void:
	var panel: Control = GameplayHubPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var alerts: Array = []
	for i in range(10):
		alerts.append("agenda-alert-%d" % i)
	panel.call("set_snapshot", {
		"date": "test-date",
		"action_points": 3,
		"treasury": "treasury",
		"neitang": "inner",
		"population": "population",
		"authority": "authority",
		"last_report": "report",
		"history": "history",
		"urgent_alerts": alerts,
	})

	var text: String = str(panel.call("visible_text"))
	if not text.contains("agenda-alert-9"):
		_fail("Gameplay hub agenda omitted later urgent alerts")
		return

	print("[TianmingGodotTest] gameplay hub agenda full-visibility scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] gameplay hub agenda full-visibility scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] gameplay hub agenda full-visibility scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
