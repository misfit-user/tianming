extends Node

const SaveSlotPanelScript := preload("res://scripts/save_slot_panel.gd")

var loaded_slots: Array = []
var deleted_slots: Array = []

func _ready() -> void:
	var panel: Control = SaveSlotPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	panel.connect("load_slot_requested", Callable(self, "_on_load_slot_requested"))
	panel.connect("delete_slot_requested", Callable(self, "_on_delete_slot_requested"))
	panel.call("set_slots", [
		{
			"slot_id": "slot_1",
			"exists": false,
			"compatible": true,
		}
	])

	var load_result: Dictionary = panel.call("request_load_slot", "slot_1")
	await get_tree().process_frame
	if bool(load_result.get("ok", true)):
		_fail("Load request accepted an empty save slot")
		return
	if not bool(load_result.get("missing", false)):
		_fail("Load request on an empty slot did not report missing")
		return
	if not loaded_slots.is_empty():
		_fail("Load request on an empty slot emitted a load signal")
		return

	var delete_result: Dictionary = panel.call("request_delete_slot", "slot_1")
	await get_tree().process_frame
	if bool(delete_result.get("ok", true)):
		_fail("Delete request accepted an empty save slot")
		return
	if not bool(delete_result.get("missing", false)):
		_fail("Delete request on an empty slot did not report missing")
		return
	if not deleted_slots.is_empty():
		_fail("Delete request on an empty slot emitted a delete signal")
		return

	print("[TianmingGodotTest] save slot missing request scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _on_load_slot_requested(slot_id: String) -> void:
	loaded_slots.append(slot_id)

func _on_delete_slot_requested(slot_id: String) -> void:
	deleted_slots.append(slot_id)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] save slot missing request scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save slot missing request scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
