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
	if not state.has_method("faction_actions") or not state.has_method("perform_faction_action"):
		_fail("GameState does not expose faction action APIs")
		return

	var actions: Array = _array(state.call("faction_actions"))
	if actions.size() < 3:
		_fail("Faction actions were not initialized")
		return
	var target: Dictionary = _prepare_target_faction(state)
	if target.is_empty():
		_fail("No targetable faction was found")
		return
	var target_id: String = str(target.get("id", ""))
	var cohesion_before: float = float(target.get("cohesion", 0))
	var treasury_before: float = float(state.get("guoku_money"))
	var ap_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("perform_faction_action", target_id, "sow_discord")
	if not result.get("ok", false):
		_fail("Faction action failed: %s" % str(result.get("error", "")))
		return

	var updated: Dictionary = state.call("faction_by_id", target_id)
	if updated.is_empty():
		_fail("Target faction disappeared after faction action")
		return
	if float(updated.get("cohesion", 0)) >= cohesion_before:
		_fail("Sow discord did not lower faction cohesion")
		return
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("Faction action did not spend treasury money")
		return
	if int(state.get("action_points")) != ap_before - 1:
		_fail("Faction action did not spend one action point")
		return
	if _array(state.get("faction_action_history")).size() != 1:
		_fail("Faction action history was not recorded")
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
	if _array(restored.get("faction_action_history")).size() != 1:
		_fail("Restored faction action history count changed")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "faction_action"):
		_fail("Faction action history did not enter chronicle entries")
		return

	print("[TianmingGodotTest] faction action scene test passed")
	_finish(0)

func _prepare_target_faction(state: RefCounted) -> Dictionary:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i]).duplicate(true)
		var id: String = str(faction.get("id", ""))
		if id.is_empty():
			continue
		faction["cohesion"] = maxf(50.0, float(faction.get("cohesion", 50)))
		factions[i] = faction
		state.set("factions", factions)
		return faction
	return {}

func _has_kind(entries: Array, kind: String) -> bool:
	for raw in entries:
		if str(_dict(raw).get("kind", "")) == kind:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction action scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction action scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
