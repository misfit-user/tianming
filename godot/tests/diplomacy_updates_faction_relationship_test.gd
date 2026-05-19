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

	var setup: Dictionary = _prepare_target_faction(state)
	if setup.is_empty():
		_fail("Could not prepare target faction")
		return

	var result: Dictionary = state.call("issue_diplomacy_action", "send_envoy", str(setup.get("target_id", "")))
	if not result.get("ok", false):
		_fail("Diplomacy action failed: %s" % str(result.get("error", "")))
		return

	var rows: Dictionary = state.call("relationship_rows")
	var relation: Dictionary = _find_relation(_array(rows.get("factions", [])), str(setup.get("player_name", "")), str(setup.get("target_name", "")))
	if relation.is_empty():
		_fail("Diplomacy action did not keep a player-target faction relationship row")
		return
	if int(_num(relation.get("value", 0))) != -18:
		_fail("Diplomacy action did not sync faction relationship value, got %s" % str(relation.get("value", "")))
		return
	if not str(relation.get("desc", "")).contains("对明关系"):
		_fail("Diplomacy action did not describe the synced faction relation")
		return

	print("[TianmingGodotTest] diplomacy updates faction relationship scene test passed")
	_finish(0)

func _prepare_target_faction(state: RefCounted) -> Dictionary:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	var player_index: int = -1
	var target_index: int = -1
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i])
		var faction_name: String = str(faction.get("name", ""))
		if player_index < 0 and (faction_name == "大明" or faction_name.contains("明")):
			player_index = i
		elif target_index < 0 and not faction_name.contains("明"):
			target_index = i
	if player_index < 0 or target_index < 0:
		return {}
	var target: Dictionary = _dict(factions[target_index]).duplicate(true)
	target["relation_to_player"] = 20
	target["hostility"] = 60
	factions[target_index] = target
	state.set("factions", factions)
	var player: Dictionary = _dict(factions[player_index])
	state.set("faction_relations", [{
		"id": "test_player_target_relation",
		"from": str(player.get("name", "")),
		"to": str(target.get("name", "")),
		"type": "neutral",
		"value": -40,
		"desc": "外交行动前的测试关系"
	}])
	return {
		"player_name": str(player.get("name", "")),
		"target_id": str(target.get("id", "")),
		"target_name": str(target.get("name", ""))
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
	print("[TianmingGodotTest] diplomacy updates faction relationship scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy updates faction relationship scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
