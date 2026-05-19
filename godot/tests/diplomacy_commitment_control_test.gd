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
	if not state.has_method("renew_diplomacy_commitment") or not state.has_method("break_diplomacy_commitment"):
		_fail("GameState does not expose diplomacy commitment renewal and break controls")
		return

	var target_id: String = _first_target_faction_id(state)
	if target_id.is_empty():
		_fail("No targetable faction was found")
		return
	var support_result: Dictionary = state.call("issue_diplomacy_action", "support_chahar", target_id)
	if not bool(support_result.get("ok", false)):
		_fail("Preparing support_chahar commitment failed: %s" % str(support_result.get("error", "")))
		return
	var action_points_before_renew: int = int(state.get("action_points"))
	var renew_result: Dictionary = state.call("renew_diplomacy_commitment", "support_chahar", target_id)
	if not bool(renew_result.get("ok", false)):
		_fail("Renewing diplomacy commitment failed: %s" % str(renew_result.get("error", "")))
		return
	if int(state.get("action_points")) != action_points_before_renew - 1:
		_fail("Renewing diplomacy commitment did not spend one action point")
		return
	var commitment: Dictionary = _dict(_array(state.get("active_diplomacy_commitments"))[0])
	if int(commitment.get("remaining_months", 0)) != 4:
		_fail("Renewing diplomacy commitment did not extend duration to 4 months")
		return
	var renew_record: Dictionary = _dict(_array(state.get("diplomacy_history"))[-1])
	if str(renew_record.get("kind", "")) != "renew_commitment":
		_fail("Renewing diplomacy commitment did not record a renewal history entry")
		return

	var before_break: Dictionary = _dict(state.call("faction_by_id", target_id))
	var break_result: Dictionary = state.call("break_diplomacy_commitment", "support_chahar", target_id)
	if not bool(break_result.get("ok", false)):
		_fail("Breaking diplomacy commitment failed: %s" % str(break_result.get("error", "")))
		return
	if not _array(state.get("active_diplomacy_commitments")).is_empty():
		_fail("Breaking diplomacy commitment did not remove the active commitment")
		return
	var after_break: Dictionary = _dict(state.call("faction_by_id", target_id))
	if int(after_break.get("relation_to_player", 0)) >= int(before_break.get("relation_to_player", 0)):
		_fail("Breaking diplomacy commitment did not reduce target relation")
		return
	if int(after_break.get("hostility", 0)) <= int(before_break.get("hostility", 0)):
		_fail("Breaking diplomacy commitment did not increase target hostility")
		return
	if int(after_break.get("ming_support", 0)) != 0:
		_fail("Breaking diplomacy commitment did not clear Ming support marker")
		return
	var break_record: Dictionary = _dict(_array(state.get("diplomacy_history"))[-1])
	if str(break_record.get("kind", "")) != "break_commitment":
		_fail("Breaking diplomacy commitment did not record a break history entry")
		return

	print("[TianmingGodotTest] diplomacy commitment control scene test passed")
	_finish(0)

func _first_target_faction_id(state: RefCounted) -> String:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i]).duplicate(true)
		var id: String = str(faction.get("id", ""))
		if id.is_empty() or str(faction.get("name", "")).contains("明"):
			continue
		faction["relation_to_player"] = 45
		faction["hostility"] = 40
		faction.erase("ming_support")
		factions[i] = faction
		state.set("factions", factions)
		return id
	return ""

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] diplomacy commitment control scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy commitment control scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
