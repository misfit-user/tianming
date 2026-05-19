extends Node

const SaveSlotPanelScript := preload("res://scripts/save_slot_panel.gd")

func _ready() -> void:
	var panel: Control = SaveSlotPanelScript.new()
	add_child(panel)
	await get_tree().process_frame

	var summary_text: String = "AP 2 · treasury summary"
	panel.call("set_slots", [
		{
			"slot_id": "slot_1",
			"exists": true,
			"compatible": true,
			"scenario_name": "Test Scenario",
			"year": 1627,
			"month": 9,
			"turn": 3,
			"saved_at_unix": 1000.0,
			"summary_text": summary_text,
		}
	])
	await get_tree().process_frame

	if not _has_label_containing(panel, summary_text):
		_fail("Save slot panel did not render the metadata summary text")
		return

	print("[TianmingGodotTest] save slot summary UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _has_label_containing(root: Node, text: String) -> bool:
	if root is Label:
		var label: Label = root as Label
		if label.text.contains(text):
			return true
	for child in root.get_children():
		if _has_label_containing(child, text):
			return true
	return false

func _fail(message: String) -> void:
	print("[TianmingGodotTest] save slot summary UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save slot summary UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
