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

	if _array(state.get("event_deck")).is_empty():
		_fail("Event deck was not loaded from scenario")
		return

	var report: Dictionary = state.call("advance_month")
	var queued_events: Array = _array(state.get("event_queue"))
	if queued_events.is_empty():
		_fail("First monthly advance did not queue any event")
		return
	if _array(report.get("events", [])).is_empty():
		_fail("Monthly report did not include queued events")
		return
	if not _contains_event(queued_events, "彗星出于房心"):
		_fail("Turn 1 rigid trigger did not queue the comet event")
		return
	if not _contains_triggered_id(state.get("triggered_event_ids"), "tianqi7_comet"):
		_fail("Triggered event ids did not record tianqi7_comet")
		return

	print("[TianmingGodotTest] event queue scene test passed")
	_finish(0)

func _contains_event(events: Array, event_name: String) -> bool:
	for raw in events:
		var event: Dictionary = raw if typeof(raw) == TYPE_DICTIONARY else {}
		if str(event.get("name", "")) == event_name:
			return true
	return false

func _contains_triggered_id(value: Variant, event_id: String) -> bool:
	if typeof(value) == TYPE_DICTIONARY:
		return (value as Dictionary).has(event_id)
	if typeof(value) == TYPE_ARRAY:
		return (value as Array).has(event_id)
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] event queue scene test exit_code=%d" % exit_code)
