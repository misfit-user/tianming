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

	_prepare_later_jin_with_broken_commitment_memory(state)
	_prepare_liaodong_region(state)
	var report: Dictionary = state.call("advance_month")
	var retaliation: Dictionary = _find_action(_array(report.get("faction_ai_actions", [])), "diplomatic_retaliation")
	if retaliation.is_empty():
		_fail("Broken-commitment memory did not trigger Later Jin diplomatic retaliation")
		return
	if str(retaliation.get("faction", "")) != "后金":
		_fail("Diplomatic retaliation did not identify Later Jin as actor")
		return
	if not str(retaliation.get("reason", "")).contains("毁约"):
		_fail("Diplomatic retaliation did not cite broken commitment memory")
		return

	var pending: Array = _array(state.get("pending_court_recommendations"))
	var counterplay: Dictionary = _find_counterplay(pending, str(retaliation.get("id", "")))
	if counterplay.is_empty():
		_fail("Diplomatic retaliation did not create a player counterplay recommendation")
		return
	if str(counterplay.get("category", "")) != "外交":
		_fail("Diplomatic retaliation counterplay was not categorized as diplomacy")
		return

	print("[TianmingGodotTest] faction AI memory strategy scene test passed")
	_finish(0)

func _prepare_later_jin_with_broken_commitment_memory(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		if str(faction.get("name", "")) != "后金":
			continue
		faction["attitude"] = "观望"
		faction["hostility"] = 62
		faction["border_tension"] = 62
		faction["military_strength"] = 280000
		faction["diplomacy_memory"] = [
			{
				"kind": "broken_commitment",
				"commitment_id": "support_chahar",
				"trust_delta": -12,
				"turn": int(state.get("turn")),
			}
		]
		rows[i] = faction
		break
	state.set("factions", rows)

func _prepare_liaodong_region(state: RefCounted) -> void:
	var rows: Array = _array(state.get("map_regions")).duplicate(true)
	for i in range(rows.size()):
		var region: Dictionary = _dict(rows[i]).duplicate(true)
		if not str(region.get("name", "")).contains("辽东"):
			continue
		region["army_pressure"] = 36
		region["unrest"] = 45
		region["mood"] = 52
		rows[i] = region
		break
	state.set("map_regions", rows)

func _find_action(actions: Array, kind: String) -> Dictionary:
	for raw in actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("kind", "")) == kind:
			return action
	return {}

func _find_counterplay(recommendations: Array, source_action_id: String) -> Dictionary:
	for raw in recommendations:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("source_faction_action_id", "")) == source_action_id:
			return recommendation
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction AI memory strategy scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction AI memory strategy scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
