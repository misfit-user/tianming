extends Node

const SaveSlotPanelScript := preload("res://scripts/save_slot_panel.gd")

var emitted_slots: Array = []

func _ready() -> void:
	var panel: Control = SaveSlotPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	if not panel.has_method("request_save_slot"):
		_fail("Save slot panel does not expose overwrite-aware save requests")
		return

	panel.connect("save_slot_requested", Callable(self, "_on_save_slot_requested"))
	panel.call("set_slots", [
		{
			"slot_id": "slot_1",
			"exists": true,
			"scenario_name": "Test Scenario",
			"year": 1627,
			"month": 9,
			"turn": 1,
			"saved_at_unix": 1000.0,
		}
	])

	var first_result: Dictionary = panel.call("request_save_slot", "slot_1")
	await get_tree().process_frame
	if not bool(first_result.get("needs_confirm", false)):
		_fail("First save request on an existing slot did not require overwrite confirmation")
		return
	if not emitted_slots.is_empty():
		_fail("First save request on an existing slot emitted a save signal before confirmation")
		return

	var second_result: Dictionary = panel.call("request_save_slot", "slot_1")
	await get_tree().process_frame
	if not bool(second_result.get("ok", false)):
		_fail("Confirmed overwrite request did not return ok")
		return
	if emitted_slots.size() != 1 or str(emitted_slots[0]) != "slot_1":
		_fail("Confirmed overwrite request did not emit the selected slot")
		return

	emitted_slots.clear()
	panel.call("set_slots", [
		{
			"slot_id": "slot_2",
			"exists": false,
		}
	])
	var empty_result: Dictionary = panel.call("request_save_slot", "slot_2")
	await get_tree().process_frame
	if not bool(empty_result.get("ok", false)):
		_fail("Save request on an empty slot did not return ok")
		return
	if emitted_slots.size() != 1 or str(emitted_slots[0]) != "slot_2":
		_fail("Save request on an empty slot did not emit immediately")
		return

	print("[TianmingGodotTest] save slot overwrite confirmation scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _on_save_slot_requested(slot_id: String) -> void:
	emitted_slots.append(slot_id)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] save slot overwrite confirmation scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save slot overwrite confirmation scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
