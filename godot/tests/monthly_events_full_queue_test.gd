extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const MonthlySimulatorScript := preload("res://scripts/monthly_simulator.gd")

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

	var events: Array = []
	for i in range(5):
		events.append({
			"id": "due_rigid_%02d" % i,
			"name": "到期事件%02d" % i,
			"source": "rigid_trigger",
			"type": "rigid_trigger",
			"category": "rigid",
			"trigger_turn": 1,
			"desc": "用于验证同月到期事件不会被截断。"
		})
	state.set("turn", 5)
	state.set("event_deck", events)
	state.set("event_queue", [])
	state.set("triggered_event_ids", {})
	state.set("map_regions", [])
	state.set("factions", [])

	var simulator: RefCounted = MonthlySimulatorScript.new()
	var report: Dictionary = simulator.call("preview_month", state)
	var queued_now: Array = _array(report.get("events", []))
	var queued_after: Array = _array(report.get("event_queue_after", []))
	var triggered_ids: Dictionary = _dict(report.get("triggered_event_ids_after", {}))
	if queued_now.size() != events.size():
		_fail("Monthly due events were truncated in report: got %d expected %d" % [
			queued_now.size(),
			events.size()
		])
		return
	if queued_after.size() != events.size():
		_fail("Monthly due events were truncated in queue: got %d expected %d" % [
			queued_after.size(),
			events.size()
		])
		return
	for raw_event in events:
		var event_id: String = str(_dict(raw_event).get("id", ""))
		if not triggered_ids.has(event_id):
			_fail("Triggered ids omitted %s" % event_id)
			return

	print("[TianmingGodotTest] monthly events full queue scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] monthly events full queue scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] monthly events full queue scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
