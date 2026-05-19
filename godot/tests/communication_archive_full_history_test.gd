extends Node

const CommunicationPanelScript := preload("res://scripts/communication_panel.gd")

func _ready() -> void:
	var panel: Control = CommunicationPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var archive: Array = []
	for i in range(6):
		archive.append({
			"id": "archive-%d" % i,
			"title": "oldest-archive" if i == 0 else "archive-%d" % i,
			"kind": "memorial",
			"turn": i + 1,
			"sender": "tester",
			"body": "archived body %d" % i,
		})
	panel.call("set_data", [], archive)
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("oldest-archive"):
		_fail("Communication archive omitted older archived entries")
		return

	print("[TianmingGodotTest] communication archive full-history scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] communication archive full-history scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] communication archive full-history scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
