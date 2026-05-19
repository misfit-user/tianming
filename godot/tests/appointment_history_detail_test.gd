extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const AppointmentPanelScript := preload("res://scripts/appointment_panel.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return

	var characters: Array = _array(state.get("characters")).duplicate(true)
	var offices: Array = _array(state.get("court_offices"))
	if characters.size() < 2 or offices.is_empty():
		_fail("Appointment detail test needs at least two characters and one office")
		return
	var old_holder: Dictionary = _dict(characters[0])
	var candidate: Dictionary = _dict(characters[1]).duplicate(true)
	candidate["loyalty"] = 50
	characters[1] = candidate
	state.set("characters", characters)
	var office: Dictionary = _dict(offices[0])
	var office_id: String = str(office.get("id", ""))
	var assignments: Dictionary = _dict(state.get("office_assignments")).duplicate(true)
	assignments[office_id] = str(old_holder.get("id", ""))
	state.set("office_assignments", assignments)

	var result: Dictionary = state.call("appoint_character", str(candidate.get("id", "")), office_id)
	if not result.get("ok", false):
		_fail("Appointment failed: %s" % str(result.get("error", "")))
		return
	var history: Array = _array(state.get("appointment_history"))
	if history.is_empty():
		_fail("Appointment history was not recorded")
		return
	var record: Dictionary = _dict(history[history.size() - 1])
	if str(record.get("old_holder", "")) != str(old_holder.get("name", "")):
		_fail("Appointment record omitted previous office holder name")
		return
	if int(_num(record.get("loyalty_delta", 0))) != 2:
		_fail("Appointment record omitted loyalty delta")
		return

	var panel: Control = AppointmentPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", offices, _array(state.get("characters")), _dict(state.get("office_assignments")), history, int(_num(state.get("action_points"))))
	await get_tree().process_frame
	var text: String = str(panel.call("visible_text"))
	if not text.contains(str(old_holder.get("name", ""))) or not text.contains("前任"):
		_fail("Appointment history UI omitted previous office holder")
		return
	if not text.contains("忠诚 +2"):
		_fail("Appointment history UI omitted loyalty delta")
		return

	print("[TianmingGodotTest] appointment history detail scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	print("[TianmingGodotTest] appointment history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] appointment history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
