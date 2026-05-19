extends Node

const CourtMeetingPanelScript := preload("res://scripts/court_meeting_panel.gd")

func _ready() -> void:
	var panel: Control = CourtMeetingPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var topics: Array = [{
		"id": "finance_council",
		"name": "户部会议",
		"domain": "finance",
		"cost": 1,
		"desc": "议岁入岁出。"
	}]
	var characters: Array = []
	for i in range(22):
		characters.append({
			"id": "official_%02d" % i,
			"name": "廷臣%02d" % i,
			"official_title": "候议官",
			"loyalty": 45 + i,
			"intelligence": 50 + i,
			"administration": 52 + i,
			"management": 40 + i,
			"military": 20,
			"valor": 10
		})

	panel.call("set_data", topics, characters, [], 3, [], [])
	await get_tree().process_frame

	var participants_box: VBoxContainer = panel.get("participants_box") as VBoxContainer
	if participants_box == null:
		_fail("Court meeting panel did not expose participants_box")
		return
	if participants_box.get_child_count() != characters.size():
		_fail("Court meeting panel truncated participants: got %d expected %d" % [
			participants_box.get_child_count(),
			characters.size()
		])
		return

	print("[TianmingGodotTest] court meeting participant full visibility scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court meeting participant full visibility scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting participant full visibility scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
