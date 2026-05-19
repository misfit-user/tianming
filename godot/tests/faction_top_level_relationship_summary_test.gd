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

	var factions: Array = _array(state.get("factions"))
	if factions.size() < 2:
		_fail("Not enough factions for relationship summary test")
		return
	var first: Dictionary = _dict(factions[0])
	var second: Dictionary = _dict(factions[1])
	var first_id: String = str(first.get("id", ""))
	var first_name: String = str(first.get("name", ""))
	var second_name: String = str(second.get("name", ""))
	if first_id.is_empty() or first_name.is_empty() or second_name.is_empty():
		_fail("Faction rows did not expose id/name values")
		return

	state.set("faction_relations", [{
		"id": "test_faction_relation",
		"from": first_name,
		"to": second_name,
		"type": "war",
		"value": -95,
		"desc": "测试用势力关系"
	}])

	var faction: Dictionary = state.call("faction_by_id", first_id)
	var text: String = str(faction.get("relations_text", ""))
	if not text.contains(second_name):
		_fail("Faction relationship summary omitted the related faction")
		return
	if not text.contains("-95"):
		_fail("Faction relationship summary omitted relation value")
		return
	if not text.contains("测试用势力关系"):
		_fail("Faction relationship summary omitted relation description")
		return

	print("[TianmingGodotTest] faction top-level relationship summary scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction top-level relationship summary scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction top-level relationship summary scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
