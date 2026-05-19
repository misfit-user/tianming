extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	var dongjiang_state: RefCounted = _new_state(load_result)
	if dongjiang_state == null:
		return
	dongjiang_state.set("event_deck", [_event_by_name(_array(dongjiang_state.get("event_deck")), "东江毛文龙请饷")])
	dongjiang_state.call("set_variable_value", "辽饷积欠", 250)
	dongjiang_state.call("set_variable_value", "东江空饷被举发", 1)
	dongjiang_state.call("advance_month")
	if not _contains_event(_array(dongjiang_state.get("event_queue")), "东江毛文龙请饷"):
		_fail("Parenthesized in-office trigger with flag predicate did not queue Dongjiang event")
		return

	var shaanxi_state: RefCounted = _new_state(load_result)
	if shaanxi_state == null:
		return
	shaanxi_state.set("event_deck", [_event_by_name(_array(shaanxi_state.get("event_deck")), "陕西洪承畴请剿饥民")])
	shaanxi_state.call("set_variable_value", "流民数量", 0)
	shaanxi_state.call("set_variable_value", "陕西民变初起", 1)
	shaanxi_state.call("advance_month")
	if not _contains_event(_array(shaanxi_state.get("event_queue")), "陕西洪承畴请剿饥民"):
		_fail("Bare flag predicate did not queue Shaanxi suppression event")
		return

	var xuguangqi_absent_state: RefCounted = _new_state(load_result)
	if xuguangqi_absent_state == null:
		return
	xuguangqi_absent_state.set("event_deck", [_event_by_name(_array(xuguangqi_absent_state.get("event_deck")), "徐光启献《农政全书》稿")])
	xuguangqi_absent_state.call("set_variable_value", "东林党复苏进度", 0)
	xuguangqi_absent_state.call("advance_month")
	if _contains_event(_array(xuguangqi_absent_state.get("event_queue")), "徐光启献《农政全书》稿"):
		_fail("Absent-from-court character predicate queued Xu Guangqi event")
		return

	var xuguangqi_court_state: RefCounted = _new_state(load_result)
	if xuguangqi_court_state == null:
		return
	xuguangqi_court_state.set("event_deck", [_event_by_name(_array(xuguangqi_court_state.get("event_deck")), "徐光启献《农政全书》稿")])
	xuguangqi_court_state.call("set_variable_value", "东林党复苏进度", 0)
	_put_character_in_court(xuguangqi_court_state, "徐光启")
	xuguangqi_court_state.call("advance_month")
	if not _contains_event(_array(xuguangqi_court_state.get("event_queue")), "徐光启献《农政全书》稿"):
		_fail("In-court character predicate did not queue Xu Guangqi event")
		return

	print("[TianmingGodotTest] conditional event predicates scene test passed")
	_finish(0)

func _new_state(load_result: Dictionary) -> RefCounted:
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return null
	return state

func _event_by_name(events: Array, event_name: String) -> Dictionary:
	for raw in events:
		var event: Dictionary = _dict(raw)
		if str(event.get("name", "")) == event_name:
			return event
	return {}

func _put_character_in_court(state: RefCounted, character_name: String) -> void:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		if str(character.get("name", "")) != character_name:
			continue
		character["official_title"] = "礼部尚书"
		character["title"] = "礼部尚书"
		rows[i] = character
		break
	state.set("characters", rows)

func _contains_event(events: Array, event_name: String) -> bool:
	for raw in events:
		var event: Dictionary = _dict(raw)
		if str(event.get("name", "")) == event_name:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] conditional event predicates scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
