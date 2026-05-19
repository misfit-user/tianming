extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	var state: RefCounted = _new_state(load_result)
	if state == null:
		return
	_prepare_faction_scores(state)
	state.set("month", 9)
	state.set("event_deck", [
		_conditional_event("evt_world_later_jin_pressure", "后金边压入奏", "后金敌意 > 80 且 后金边境紧张 >= 75"),
		_conditional_event("evt_world_chahar_relation", "察哈尔离心", "察哈尔关系 < 30"),
		_conditional_event("evt_world_autumn", "秋防议", "秋季"),
	])
	state.call("advance_month")
	var queued: Array = _array(state.get("event_queue"))
	if not _contains_event(queued, "后金边压入奏"):
		_fail("Faction hostility/border-tension trigger did not queue event")
		return
	if not _contains_event(queued, "察哈尔离心"):
		_fail("Faction relation trigger did not queue event")
		return
	if not _contains_event(queued, "秋防议"):
		_fail("Season trigger did not queue autumn event")
		return

	var winter_state: RefCounted = _new_state(load_result)
	if winter_state == null:
		return
	winter_state.set("month", 9)
	winter_state.set("event_deck", [_conditional_event("evt_world_winter", "冬防议", "冬季")])
	winter_state.call("advance_month")
	if _contains_event(_array(winter_state.get("event_queue")), "冬防议"):
		_fail("Winter season trigger queued event during ninth month")
		return

	var month_state: RefCounted = _new_state(load_result)
	if month_state == null:
		return
	month_state.set("month", 9)
	month_state.set("event_deck", [_conditional_event("evt_world_month", "九月警", "月份 >= 9")])
	month_state.call("advance_month")
	if not _contains_event(_array(month_state.get("event_queue")), "九月警"):
		_fail("Named month world-state trigger did not queue event")
		return

	print("[TianmingGodotTest] conditional event world predicates scene test passed")
	_finish(0)

func _new_state(load_result: Dictionary) -> RefCounted:
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return null
	return state

func _prepare_faction_scores(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		match str(faction.get("name", "")):
			"后金":
				faction["hostility"] = 86
				faction["border_tension"] = 78
			"察哈尔":
				faction["relation_to_player"] = 24
				faction["hostility"] = 20
		rows[i] = faction
	state.set("factions", rows)

func _conditional_event(id: String, event_name: String, trigger: String) -> Dictionary:
	return {
		"id": id,
		"name": event_name,
		"type": "conditional",
		"category": "conditional",
		"source": "events",
		"trigger": trigger,
		"effect": "",
		"effect_data": {},
		"choices": [],
		"description": event_name,
	}

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
	print("[TianmingGodotTest] conditional event world predicates scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] conditional event world predicates scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
