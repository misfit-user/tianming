extends Node

const CommunicationPanelScript := preload("res://scripts/communication_panel.gd")

func _ready() -> void:
	var panel: Control = CommunicationPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	panel.call("set_data", [], [{
		"id": "archive-detail",
		"title": "辽饷积欠奏",
		"kind": "memorial",
		"turn": 2,
		"sender": "兵部",
		"body": "辽东与九边饷项连年积欠，边镇请先核拨现银。",
		"processed_action": "recommend",
		"status": "recommended",
		"created_recommendation_id": "recommend-2-archive-detail"
	}])
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("兵部") or not text.contains("辽饷积欠奏"):
		_fail("Communication archive detail omitted sender or title")
		return
	if not text.contains("辽东与九边饷项连年积欠"):
		_fail("Communication archive detail omitted body text")
		return
	if not text.contains("已纳入议事") or not text.contains("recommend-2-archive-detail"):
		_fail("Communication archive detail omitted processing status")
		return

	print("[TianmingGodotTest] communication archive detail scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] communication archive detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] communication archive detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
