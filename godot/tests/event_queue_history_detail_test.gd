extends Node

const EventQueuePanelScript := preload("res://scripts/event_queue_panel.gd")

func _ready() -> void:
	var panel: Control = EventQueuePanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	panel.call("set_events", [], [{
		"id": "resolved-test",
		"name": "阉党请加魏忠贤上公号",
		"source": "朝议",
		"type": "党争",
		"resolved_turn": 4,
		"choice_text": "暂缓上公号",
		"applied_effects": {
			"direct": {"皇威": 3},
			"variables": {"阉党权势值": -2, "党争烈度": 3}
		}
	}])
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("阉党请加魏忠贤上公号"):
		_fail("Event history omitted resolved event name")
		return
	if not text.contains("暂缓上公号"):
		_fail("Event history omitted resolved choice text")
		return
	if not text.contains("皇威") or not text.contains("阉党权势值") or not text.contains("党争烈度"):
		_fail("Event history omitted applied effect details")
		return

	print("[TianmingGodotTest] event queue history detail scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] event queue history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] event queue history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
