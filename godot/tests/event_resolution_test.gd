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
	if not state.has_method("resolve_event"):
		_fail("GameState does not expose resolve_event")
		return

	state.call("advance_month")
	var huangwei_before: float = float(state.get("huangwei"))
	var winter_before: float = float(state.call("variable_value", "小冰河凛冬指数"))
	var comet_result: Dictionary = state.call("resolve_event", "tianqi7_comet", -1)
	if not comet_result.get("ok", false):
		_fail("Comet event did not resolve: %s" % str(comet_result.get("error", "")))
		return
	if not is_equal_approx(float(state.get("huangwei")), huangwei_before - 5.0):
		_fail("Comet event did not apply huangwei effect")
		return
	if not is_equal_approx(float(state.call("variable_value", "小冰河凛冬指数")), winter_before + 3.0):
		_fail("Comet event did not apply winter index effect")
		return
	if _contains_event(_array(state.get("event_queue")), "彗星出于房心"):
		_fail("Resolved comet event remained in queue")
		return

	var choice_event: Dictionary = _event_by_name(_array(state.get("event_deck")), "阉党请加魏忠贤上公号")
	if choice_event.is_empty():
		_fail("Choice event was not loaded")
		return
	state.set("event_queue", [choice_event])
	huangwei_before = float(state.get("huangwei"))
	var yandang_before: float = float(state.call("variable_value", "阉党权势值"))
	var party_before: float = float(state.call("variable_value", "党争烈度"))
	var choice_result: Dictionary = state.call("resolve_event", str(choice_event.get("id", "")), 1)
	if not choice_result.get("ok", false):
		_fail("Choice event did not resolve: %s" % str(choice_result.get("error", "")))
		return
	if not is_equal_approx(float(state.get("huangwei")), huangwei_before + 3.0):
		_fail("Choice event did not apply huangwei choice effect")
		return
	if not is_equal_approx(float(state.call("variable_value", "阉党权势值")), yandang_before - 2.0):
		_fail("Choice event did not apply faction variable effect")
		return
	if not is_equal_approx(float(state.call("variable_value", "党争烈度")), party_before + 3.0):
		_fail("Choice event did not apply party-strife effect")
		return

	print("[TianmingGodotTest] event resolution scene test passed")
	_finish(0)

func _event_by_name(events: Array, event_name: String) -> Dictionary:
	for raw in events:
		var event: Dictionary = raw if typeof(raw) == TYPE_DICTIONARY else {}
		if str(event.get("name", "")) == event_name:
			return event
	return {}

func _contains_event(events: Array, event_name: String) -> bool:
	for raw in events:
		var event: Dictionary = raw if typeof(raw) == TYPE_DICTIONARY else {}
		if str(event.get("name", "")) == event_name:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] event resolution scene test exit_code=%d" % exit_code)
