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

	var target_id: String = _first_target_faction_id(state)
	if target_id.is_empty():
		_fail("No targetable faction was found")
		return
	state.call("issue_diplomacy_action", "support_chahar", target_id)
	state.call("renew_diplomacy_commitment", "support_chahar", target_id)

	var after_renew: Dictionary = _dict(state.call("faction_by_id", target_id))
	var renew_memory: Dictionary = _last_memory(after_renew, "renewed_commitment")
	if renew_memory.is_empty() or str(renew_memory.get("commitment_id", "")) != "support_chahar":
		_fail("Renewing diplomacy commitment did not add target faction AI memory")
		return

	state.call("break_diplomacy_commitment", "support_chahar", target_id)
	var after_break: Dictionary = _dict(state.call("faction_by_id", target_id))
	var break_memory: Dictionary = _last_memory(after_break, "broken_commitment")
	if break_memory.is_empty() or str(break_memory.get("commitment_id", "")) != "support_chahar":
		_fail("Breaking diplomacy commitment did not add target faction AI memory")
		return
	if float(break_memory.get("trust_delta", 0.0)) >= 0.0:
		_fail("Broken commitment memory did not record a negative trust delta")
		return

	print("[TianmingGodotTest] diplomacy commitment memory scene test passed")
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
		faction["diplomacy_memory"] = []
		faction.erase("ming_support")
		factions[i] = faction
		state.set("factions", factions)
		return id
	return ""

func _last_memory(faction: Dictionary, kind: String) -> Dictionary:
	var memory: Array = _array(faction.get("diplomacy_memory", []))
	for i in range(memory.size() - 1, -1, -1):
		var entry: Dictionary = _dict(memory[i])
		if str(entry.get("kind", "")) == kind:
			return entry
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] diplomacy commitment memory scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy commitment memory scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
