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
	if not state.has_method("issue_diplomacy_action"):
		_fail("GameState does not expose issue_diplomacy_action")
		return
	if _array(state.get("diplomacy_actions")).is_empty():
		_fail("Diplomacy actions were not initialized")
		return

	var target_id: String = _prepare_target_faction(state)
	if target_id.is_empty():
		_fail("No targetable faction was found")
		return
	var target_before: Dictionary = _faction_by_id(_array(state.get("factions")), target_id)
	var treasury_before: float = float(state.get("guoku_money"))
	var action_points_before: int = int(state.get("action_points"))

	var result: Dictionary = state.call("issue_diplomacy_action", "send_envoy", target_id)
	if not result.get("ok", false):
		_fail("Diplomacy action failed: %s" % str(result.get("error", "")))
		return

	var updated: Dictionary = _faction_by_id(_array(state.get("factions")), target_id)
	if updated.is_empty():
		_fail("Target faction disappeared after diplomacy action")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Diplomacy action did not spend one action point")
		return
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("Diplomacy action did not spend treasury money")
		return
	if float(updated.get("relation_to_player", 0)) <= float(target_before.get("relation_to_player", 0)):
		_fail("Diplomacy action did not improve relation")
		return
	if float(updated.get("hostility", 0)) >= float(target_before.get("hostility", 0)):
		_fail("Diplomacy action did not reduce hostility")
		return
	if _array(state.get("diplomacy_history")).is_empty():
		_fail("Diplomacy history was not recorded")
		return

	print("[TianmingGodotTest] diplomacy scene test passed")
	_finish(0)

func _prepare_target_faction(state: RefCounted) -> String:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i]).duplicate(true)
		var id: String = str(faction.get("id", ""))
		if id.is_empty() or str(faction.get("name", "")).contains("明"):
			continue
		faction["relation_to_player"] = 20
		faction["hostility"] = 60
		factions[i] = faction
		state.set("factions", factions)
		return id
	return ""

func _faction_by_id(factions: Array, id: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")) == id:
			return faction
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
