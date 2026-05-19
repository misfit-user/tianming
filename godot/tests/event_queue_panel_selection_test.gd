extends Node

const EventQueuePanelScript := preload("res://scripts/event_queue_panel.gd")

func _ready() -> void:
	var panel: Control = EventQueuePanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	if not panel.has_method("select_event") or not panel.has_method("visible_text"):
		_fail("Event queue panel does not expose selection APIs")
		return

	var events: Array = [
		{
			"id": "event_one",
			"name": "首事件",
			"source": "test",
			"type": "政务",
			"queued_turn": 1,
			"description": "第一件待议事件。",
			"effect": "皇威 -1",
			"choices": []
		},
		{
			"id": "event_two",
			"name": "次事件",
			"source": "test",
			"type": "军务",
			"queued_turn": 1,
			"description": "第二件待议事件。",
			"effect": "辽饷积欠 -10",
			"choices": []
		}
	]
	var resolved: Dictionary = {
		"id": "",
		"choice": 99
	}
	panel.connect("event_resolve_requested", func(event_id: String, choice_index: int) -> void:
		resolved["id"] = event_id
		resolved["choice"] = choice_index
	)
	panel.call("set_events", events, [])
	panel.call("select_event", "event_two")
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("次事件") or text.contains("第一件待议事件"):
		_fail("Selecting the second event did not update visible text")
		return
	var button: Button = _find_button_with_text(panel, "处理事件")
	if button == null:
		_fail("Selected event did not expose a resolve button")
		return
	button.emit_signal("pressed")
	if str(resolved.get("id", "")) != "event_two" or int(resolved.get("choice", 99)) != -1:
		_fail("Resolve button did not target the selected event")
		return

	print("[TianmingGodotTest] event queue panel selection scene test passed")
	_finish(0)

func _find_button_with_text(root: Node, text_part: String) -> Button:
	if root is Button and str((root as Button).text).contains(text_part):
		return root as Button
	for child in root.get_children():
		var found: Button = _find_button_with_text(child, text_part)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	print("[TianmingGodotTest] event queue panel selection scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] event queue panel selection scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
