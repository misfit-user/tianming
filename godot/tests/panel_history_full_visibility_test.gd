extends Node

const AppointmentPanelScript := preload("res://scripts/appointment_panel.gd")
const AudiencePanelScript := preload("res://scripts/audience_panel.gd")
const CharacterDetailPanelScript := preload("res://scripts/character_detail_panel.gd")
const CourtActionPanelScript := preload("res://scripts/court_action_panel.gd")
const CourtMeetingPanelScript := preload("res://scripts/court_meeting_panel.gd")
const DiplomacyPanelScript := preload("res://scripts/diplomacy_panel.gd")
const EdictPanelScript := preload("res://scripts/edict_panel.gd")
const EventQueuePanelScript := preload("res://scripts/event_queue_panel.gd")
const FactionDetailPanelScript := preload("res://scripts/faction_detail_panel.gd")
const MilitaryOrderPanelScript := preload("res://scripts/military_order_panel.gd")
const RegionGovernancePanelScript := preload("res://scripts/region_governance_panel.gd")
const StatecraftPanelScript := preload("res://scripts/statecraft_panel.gd")

func _ready() -> void:
	await _check_court_action_history()
	await _check_appointment_history()
	await _check_audience_history()
	await _check_court_meeting_history()
	await _check_edict_history()
	await _check_military_order_history()
	await _check_diplomacy_history()
	await _check_event_queue_history()
	await _check_character_history()
	await _check_faction_history()
	await _check_region_governance_history()
	await _check_statecraft_history()

	print("[TianmingGodotTest] panel history full-visibility scene test passed")
	_finish(0)

func _check_court_action_history() -> void:
	var panel: Control = CourtActionPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_actions", [], 3, _history_rows(7, "oldest-court-action", "name"))
	_assert_contains(_label_text(panel, "history_label"), "oldest-court-action", "Court action history omitted older rows")

func _check_appointment_history() -> void:
	var panel: Control = AppointmentPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], {}, _appointment_rows(), 3)
	_assert_contains(_label_text(panel, "history_label"), "oldest-appointment", "Appointment history omitted older rows")

func _check_audience_history() -> void:
	var panel: Control = AudiencePanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], _audience_rows(), 3)
	_assert_contains(_label_text(panel, "history_label"), "oldest-audience", "Audience history omitted older rows")

func _check_court_meeting_history() -> void:
	var panel: Control = CourtMeetingPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], _meeting_rows(), 3, [], _enacted_rows())
	var text: String = _label_text(panel, "history_label")
	_assert_contains(text, "oldest-meeting", "Court meeting history omitted older rows")
	_assert_contains(text, "oldest-enacted", "Court enacted recommendation history omitted older rows")

func _check_edict_history() -> void:
	var panel: Control = EdictPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], _history_rows(7, "oldest-edict", "name"), 3)
	_assert_contains(_label_text(panel, "history_label"), "oldest-edict", "Edict history omitted older rows")

func _check_military_order_history() -> void:
	var panel: Control = MilitaryOrderPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], _history_rows(7, "oldest-military", "name"), 3)
	_assert_contains(_label_text(panel, "history_label"), "oldest-military", "Military order history omitted older rows")

func _check_diplomacy_history() -> void:
	var panel: Control = DiplomacyPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", [], [], _history_rows(7, "oldest-diplomacy", "name"), 3, [])
	_assert_contains(_label_text(panel, "history_label"), "oldest-diplomacy", "Diplomacy history omitted older rows")

func _check_event_queue_history() -> void:
	var panel: Control = EventQueuePanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_events", [], _history_rows(6, "oldest-event", "name"))
	_assert_contains(_label_text(panel, "history_label"), "oldest-event", "Event queue history omitted older rows")

func _check_character_history() -> void:
	var panel: Control = CharacterDetailPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_character", {"id": "c1", "name": "Character One"})
	panel.call("set_character_actions", [], _scoped_rows(10, "oldest-character", "character_id", "c1"), 3)
	_assert_contains(_label_text(panel, "action_history_label"), "oldest-character", "Character history omitted older rows")

func _check_faction_history() -> void:
	var panel: Control = FactionDetailPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_faction", {"id": "f1", "name": "Faction One"})
	panel.call("set_faction_actions", [], _scoped_rows(10, "oldest-faction", "target_faction_id", "f1"), 3)
	_assert_contains(_label_text(panel, "action_history_label"), "oldest-faction", "Faction history omitted older rows")

func _check_region_governance_history() -> void:
	var panel: Control = RegionGovernancePanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	var regions: Array = [{"id": "r1", "name": "Region One", "mood": 50, "unrest": 10, "troops": 0}]
	panel.call("set_data", regions, [], _scoped_rows(10, "oldest-region", "target_region_id", "r1"), 3)
	_assert_contains(_label_text(panel, "history_label"), "oldest-region", "Region governance history omitted older rows")

func _check_statecraft_history() -> void:
	var panel: Control = StatecraftPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	var variables: Array = [{"name": "var1", "value": 10, "description": "state variable"}]
	panel.call("set_data", variables, [], _scoped_rows(10, "oldest-statecraft", "target_variable", "var1"), 3)
	_assert_contains(_label_text(panel, "history_label"), "oldest-statecraft", "Statecraft history omitted older rows")

func _history_rows(count: int, oldest_name: String, name_key: String) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({
			"turn": i + 1,
			name_key: oldest_name if i == 0 else "%s-%d" % [name_key, i],
			"target_region": "target",
			"target_faction": "target",
			"outcome": "history result %d" % i,
		})
	return rows

func _appointment_rows() -> Array:
	var rows: Array = []
	for i in range(6):
		rows.append({
			"turn": i + 1,
			"character": "oldest-appointment" if i == 0 else "official-%d" % i,
			"office": "office-%d" % i,
		})
	return rows

func _audience_rows() -> Array:
	var rows: Array = []
	for i in range(8):
		rows.append({
			"turn": i + 1,
			"character_name": "official-%d" % i,
			"topic": "topic-%d" % i,
			"response": "oldest-audience" if i == 0 else "response-%d" % i,
		})
	return rows

func _meeting_rows() -> Array:
	return _history_rows(7, "oldest-meeting", "name")

func _enacted_rows() -> Array:
	var rows: Array = []
	for i in range(5):
		rows.append({
			"turn": i + 1,
			"enacted_turn": i + 1,
			"name": "oldest-enacted" if i == 0 else "enacted-%d" % i,
		})
	return rows

func _scoped_rows(count: int, oldest_action: String, scope_key: String, scope_value: String) -> Array:
	var rows: Array = []
	for i in range(count):
		rows.append({
			"turn": i + 1,
			scope_key: scope_value,
			"action": oldest_action if i == 0 else "action-%d" % i,
			"outcome": "history result %d" % i,
		})
	return rows

func _label_text(panel: Object, property_name: String) -> String:
	var label: Label = panel.get(property_name) as Label
	return "" if label == null else label.text

func _assert_contains(text: String, needle: String, message: String) -> void:
	if not text.contains(needle):
		_fail(message)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] panel history full-visibility scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] panel history full-visibility scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
