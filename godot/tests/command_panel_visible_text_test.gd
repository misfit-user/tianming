extends Node

const AppointmentPanelScript := preload("res://scripts/appointment_panel.gd")
const CourtMeetingPanelScript := preload("res://scripts/court_meeting_panel.gd")
const DiplomacyPanelScript := preload("res://scripts/diplomacy_panel.gd")
const EdictPanelScript := preload("res://scripts/edict_panel.gd")
const MilitaryOrderPanelScript := preload("res://scripts/military_order_panel.gd")

func _ready() -> void:
	await _check_appointment_visible_text()
	await _check_edict_visible_text()
	await _check_military_order_visible_text()
	await _check_diplomacy_visible_text()
	await _check_court_meeting_visible_text()

	print("[TianmingGodotTest] command panel visible-text scene test passed")
	_finish(0)

func _check_appointment_visible_text() -> void:
	var panel: Control = AppointmentPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [{"id": "office-1", "name": "Office One", "domain": "civil"}], [], {}, [{"character": "oldest-appointment", "office": "Office One"}], 3)
	_assert_panel_text(panel, "oldest-appointment", "Appointment panel missing visible_text history")

func _check_edict_visible_text() -> void:
	var panel: Control = EdictPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], [{"turn": 1, "name": "oldest-edict", "target_region": "Region One"}], 3)
	_assert_panel_text(panel, "oldest-edict", "Edict panel missing visible_text history")

func _check_military_order_visible_text() -> void:
	var panel: Control = MilitaryOrderPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], [{"turn": 1, "name": "oldest-military", "target_region": "Region One"}], 3)
	_assert_panel_text(panel, "oldest-military", "Military order panel missing visible_text history")

func _check_diplomacy_visible_text() -> void:
	var panel: Control = DiplomacyPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], [{"turn": 1, "name": "oldest-diplomacy", "target_faction": "Faction One"}], 3, [])
	_assert_panel_text(panel, "oldest-diplomacy", "Diplomacy panel missing visible_text history")

func _check_court_meeting_visible_text() -> void:
	var panel: Control = CourtMeetingPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	var history: Array = [{"turn": 1, "name": "oldest-meeting", "score": 80, "outcome": "resolved"}]
	var enacted: Array = [{"turn": 1, "enacted_turn": 1, "name": "oldest-enacted"}]
	panel.call("set_data", [], [], history, 3, [], enacted)
	var text: String = _panel_text(panel)
	if not text.contains("oldest-meeting") or not text.contains("oldest-enacted"):
		_fail("Court meeting panel missing visible_text history")

func _assert_panel_text(panel: Object, needle: String, message: String) -> void:
	var text: String = _panel_text(panel)
	if not text.contains(needle):
		_fail(message)

func _panel_text(panel: Object) -> String:
	if not panel.has_method("visible_text"):
		return ""
	return str(panel.call("visible_text"))

func _fail(message: String) -> void:
	print("[TianmingGodotTest] command panel visible-text scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] command panel visible-text scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
