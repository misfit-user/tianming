extends Node

const CourtMeetingPanelScript := preload("res://scripts/court_meeting_panel.gd")

func _ready() -> void:
	var panel: Control = CourtMeetingPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var history: Array = [{
		"turn": 1,
		"name": "meeting",
		"score": 80,
		"outcome": "resolved",
		"agenda_pressure": _agenda_rows(5),
		"debate_entries": _debate_rows(7),
	}]
	panel.call("set_data", [], [], history, 3, [], [])

	var text: String = str(panel.call("visible_text"))
	if not text.contains("agenda-sentinel-4"):
		_fail("Court meeting agenda omitted later pressure entries")
		return
	if not text.contains("debate-sentinel-6"):
		_fail("Court meeting debate omitted later debate entries")
		return

	print("[TianmingGodotTest] court meeting detail full-visibility scene test passed")
	_finish(0)

func _agenda_rows(count: int) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({
			"target_region": "agenda-sentinel-%d" % i,
			"severity": 50 + i,
			"summary": "agenda summary %d" % i,
		})
	return rows

func _debate_rows(count: int) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({
			"name": "debate-sentinel-%d" % i,
			"stance": "support",
			"party": "test",
		})
	return rows

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court meeting detail full-visibility scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting detail full-visibility scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
