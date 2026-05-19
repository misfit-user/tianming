extends Node

const SaveSlotPanelScript := preload("res://scripts/save_slot_panel.gd")

var emitted_slots: Array = []

func _ready() -> void:
	var panel: Control = SaveSlotPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	panel.connect("save_slot_requested", Callable(self, "_on_save_slot_requested"))
	panel.call("set_slots", [
		{
			"slot_id": "slot_1",
			"exists": true,
			"compatible": true,
		}
	])

	var first_result: Dictionary = panel.call("request_save_slot", "slot_1")
	await get_tree().process_frame
	if not bool(first_result.get("needs_confirm", false)):
		_fail("First save request on an existing slot did not require confirmation")
		return
	if not emitted_slots.is_empty():
		_fail("First save request emitted before confirmation")
		return

	panel.call("set_slots", [
		{
			"slot_id": "slot_1",
			"exists": false,
			"compatible": true,
		}
	])
	panel.call("set_slots", [
		{
			"slot_id": "slot_1",
			"exists": true,
			"compatible": true,
		}
	])

	var refreshed_result: Dictionary = panel.call("request_save_slot", "slot_1")
	await get_tree().process_frame
	if not bool(refreshed_result.get("needs_confirm", false)):
		_fail("Refreshed existing slot reused stale overwrite confirmation")
		return
	if not emitted_slots.is_empty():
		_fail("Refreshed existing slot emitted save without a fresh confirmation")
		return

	print("[TianmingGodotTest] save slot overwrite refresh scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _on_save_slot_requested(slot_id: String) -> void:
	emitted_slots.append(slot_id)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] save slot overwrite refresh scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save slot overwrite refresh scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
