extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

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

	state.call("set_variable_value", "阉党权势值", 92)
	state.set("huangwei", 50.0)
	var report: Dictionary = state.call("advance_month")
	var queued_events: Array = _array(state.get("event_queue"))
	if not _contains_event(queued_events, "阉党请加魏忠贤上公号"):
		_fail("Conditional event was not discovered from trigger variables")
		return
	var report_events: Array = _matching_report_events(_array(report.get("events", [])), "阉党请加魏忠贤上公号")
	if report_events.is_empty():
		_fail("Monthly report did not include discovered conditional event")
		return
	var triggered_event_id: String = str(_dict(report_events[0]).get("id", ""))
	if triggered_event_id.is_empty():
		_fail("Discovered conditional event did not expose an id")
		return
	if not _contains_triggered_id(state.get("triggered_event_ids"), triggered_event_id):
		_fail("Triggered ids did not record discovered conditional event")
		return

	print("[TianmingGodotTest] conditional event discovery scene test passed")
	_finish(0)

func _contains_event(events: Array, event_name: String) -> bool:
	for raw in events:
		var event: Dictionary = _dict(raw)
		if str(event.get("name", "")) == event_name:
			return true
	return false

func _matching_report_events(events: Array, event_name: String) -> Array:
	var found: Array = []
	for raw in events:
		var event: Dictionary = _dict(raw)
		if str(event.get("name", "")) == event_name:
			found.append(event)
	return found

func _contains_triggered_id(value: Variant, event_id: String) -> bool:
	if typeof(value) == TYPE_DICTIONARY:
		return (value as Dictionary).has(event_id)
	if typeof(value) == TYPE_ARRAY:
		return (value as Array).has(event_id)
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] conditional event discovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
