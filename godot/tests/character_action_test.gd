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
	if not state.has_method("character_actions") or not state.has_method("perform_character_action"):
		_fail("GameState does not expose character action APIs")
		return

	var actions: Array = _array(state.call("character_actions"))
	if actions.size() < 3:
		_fail("Character actions were not initialized")
		return
	var characters: Array = _array(state.get("characters"))
	if characters.is_empty():
		_fail("Characters were not loaded")
		return

	var character: Dictionary = _first_rewardable_character(characters)
	if character.is_empty():
		_fail("No rewardable character was found")
		return
	var character_id: String = str(character.get("id", ""))
	var loyalty_before: float = float(character.get("loyalty", 0))
	var neitang_before: float = float(state.get("neitang_money"))
	var ap_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("perform_character_action", character_id, "reward")
	if not result.get("ok", false):
		_fail("Character reward failed: %s" % str(result.get("error", "")))
		return
	var updated: Dictionary = state.call("character_by_id", character_id)
	if float(updated.get("loyalty", 0)) <= loyalty_before:
		_fail("Reward did not raise character loyalty")
		return
	if float(state.get("neitang_money")) >= neitang_before:
		_fail("Reward did not spend inner treasury money")
		return
	if int(state.get("action_points")) != ap_before - 1:
		_fail("Character action did not spend one action point")
		return
	if _array(state.get("character_action_history")).size() != 1:
		_fail("Character action history was not recorded")
		return

	var snapshot: Dictionary = state.call("create_save_snapshot")
	var restored: RefCounted = GameStateScript.new()
	var restored_init: Dictionary = restored.call("load_from_scenario_result", load_result)
	if not restored_init.get("ok", false):
		_fail("Restored state init failed: %s" % str(restored_init.get("error", "")))
		return
	var restore_result: Dictionary = restored.call("restore_save_snapshot", snapshot)
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	if _array(restored.get("character_action_history")).size() != 1:
		_fail("Restored character action history count changed")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "character_action"):
		_fail("Character action history did not enter chronicle entries")
		return

	print("[TianmingGodotTest] character action scene test passed")
	_finish(0)

func _has_kind(entries: Array, kind: String) -> bool:
	for raw in entries:
		if str(_dict(raw).get("kind", "")) == kind:
			return true
	return false

func _first_rewardable_character(characters: Array) -> Dictionary:
	for raw in characters:
		var character: Dictionary = _dict(raw)
		if not str(character.get("id", "")).is_empty() and float(character.get("loyalty", 0)) <= 90.0:
			return character
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] character action scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] character action scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
