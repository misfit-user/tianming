extends Node

const GameplayHubPanelScript := preload("res://scripts/gameplay_hub_panel.gd")
const SaveSlotPanelScript := preload("res://scripts/save_slot_panel.gd")
const SystemPanelScript := preload("res://scripts/system_panel.gd")

func _ready() -> void:
	await _check_gameplay_hub_visible_text()
	await _check_save_slot_visible_text()
	await _check_system_visible_text()

	print("[TianmingGodotTest] shell panel visible-text scene test passed")
	_finish(0)

func _check_gameplay_hub_visible_text() -> void:
	var panel: Control = GameplayHubPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_snapshot", {
		"date": "test-date",
		"action_points": 3,
		"treasury": "treasury-sentinel",
		"neitang": "inner-sentinel",
		"population": "population-sentinel",
		"authority": "authority-sentinel",
		"last_report": "report-sentinel",
		"history": "history-sentinel",
		"urgent_alerts": ["agenda-sentinel"],
	})
	_assert_panel_text(panel, "agenda-sentinel", "Gameplay hub panel missing visible_text agenda")

func _check_save_slot_visible_text() -> void:
	var panel: Control = SaveSlotPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_slots", [{
		"slot_id": "slot_1",
		"exists": true,
		"compatible": true,
		"scenario_name": "scenario-sentinel",
		"year": 1627,
		"month": 9,
		"turn": 1,
		"summary_text": "slot-summary-sentinel",
	}])
	_assert_panel_text(panel, "slot-summary-sentinel", "Save slot panel missing visible_text slot summary")

func _check_system_visible_text() -> void:
	var panel: Control = SystemPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", {"fullscreen": false, "ui_scale": 1.25, "master_volume": 0.8}, true)
	panel.call("set_status", "system-status-sentinel")
	_assert_panel_text(panel, "system-status-sentinel", "System panel missing visible_text status")

func _assert_panel_text(panel: Object, needle: String, message: String) -> void:
	if not panel.has_method("visible_text"):
		_fail(message)
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains(needle):
		_fail(message)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] shell panel visible-text scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] shell panel visible-text scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
