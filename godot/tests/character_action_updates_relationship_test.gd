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

	var setup: Dictionary = _prepare_character_relation(state)
	if setup.is_empty():
		_fail("Could not prepare emperor-target character relation")
		return

	var result: Dictionary = state.call("perform_character_action", str(setup.get("target_id", "")), "reward")
	if not result.get("ok", false):
		_fail("Character action failed: %s" % str(result.get("error", "")))
		return

	var rows: Dictionary = state.call("relationship_rows")
	var relation: Dictionary = _find_relation(_array(rows.get("characters", [])), str(setup.get("emperor_name", "")), str(setup.get("target_name", "")))
	if relation.is_empty():
		_fail("Character action did not keep an emperor-target relationship row")
		return
	if int(_num(relation.get("value", 0))) != 16:
		_fail("Character action did not sync character relationship value, got %s" % str(relation.get("value", "")))
		return
	if not str(relation.get("desc", "")).contains("人物处置"):
		_fail("Character action did not describe the synced character relation")
		return

	print("[TianmingGodotTest] character action updates relationship scene test passed")
	_finish(0)

func _prepare_character_relation(state: RefCounted) -> Dictionary:
	var characters: Array = _array(state.get("characters")).duplicate(true)
	if characters.size() < 2:
		return {}
	var emperor: Dictionary = _dict(characters[0]).duplicate(true)
	var emperor_id: String = str(emperor.get("id", ""))
	var emperor_name: String = str(emperor.get("name", ""))
	if emperor_id.is_empty() or emperor_name.is_empty():
		return {}
	var summary: Dictionary = _dict(state.get("summary")).duplicate(true)
	summary["emperor"] = emperor_name
	state.set("summary", summary)
	var target_id: String = ""
	var target_name: String = ""
	for i in range(characters.size()):
		var character: Dictionary = _dict(characters[i]).duplicate(true)
		if str(character.get("id", "")) == emperor_id:
			continue
		target_id = str(character.get("id", ""))
		target_name = str(character.get("name", ""))
		character["loyalty"] = 50
		characters[i] = character
		break
	if target_id.is_empty() or target_name.is_empty():
		return {}
	state.set("characters", characters)
	state.set("neitang_money", 100000)
	state.set("character_relations", [{
		"id": "test_character_action_relation",
		"from": emperor_name,
		"to": target_name,
		"type": "君臣",
		"value": 10,
		"desc": "处置前关系"
	}])
	return {
		"emperor_name": emperor_name,
		"target_id": target_id,
		"target_name": target_name
	}

func _find_relation(rows: Array, first_name: String, second_name: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		var from_name: String = str(row.get("from", ""))
		var to_name: String = str(row.get("to", ""))
		if (from_name == first_name and to_name == second_name) or (from_name == second_name and to_name == first_name):
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	print("[TianmingGodotTest] character action updates relationship scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] character action updates relationship scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
