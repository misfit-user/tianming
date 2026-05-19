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

	_prepare_later_jin_and_chahar(state)
	var report: Dictionary = state.call("advance_month")
	var shift: Dictionary = _find_action(_array(report.get("faction_ai_actions", [])), "alliance_shift")
	if shift.is_empty():
		_fail("Faction AI did not create a Chahar alliance shift under Later Jin pressure")
		return
	if str(shift.get("target_faction", "")) != "察哈尔":
		_fail("Alliance shift did not target Chahar")
		return

	var chahar_after: Dictionary = _faction_by_name(_array(state.get("factions")), "察哈尔")
	if str(chahar_after.get("alignment", "")) != "后金倾向":
		_fail("Alliance shift did not mark Chahar as leaning toward Later Jin")
		return
	if int(chahar_after.get("relation_to_player", 0)) >= 12:
		_fail("Alliance shift did not lower Chahar relation to the player")
		return

	var counterplay: Dictionary = _find_counterplay(_array(state.get("pending_court_recommendations")), str(shift.get("id", "")))
	if counterplay.is_empty():
		_fail("Alliance shift did not create a player diplomatic counterplay recommendation")
		return
	if str(counterplay.get("category", "")) != "外交":
		_fail("Alliance shift counterplay was not categorized as diplomacy")
		return

	print("[TianmingGodotTest] faction AI alliance shift scene test passed")
	_finish(0)

func _prepare_later_jin_and_chahar(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		match str(faction.get("name", "")):
			"后金":
				faction["attitude"] = "敌对"
				faction["hostility"] = 94
				faction["border_tension"] = 92
				faction["military_strength"] = 360000
			"察哈尔":
				faction["relation_to_player"] = 12
				faction["hostility"] = 20
				faction["military_strength"] = 50000
				faction["cohesion"] = 34
				faction.erase("ming_support")
				faction.erase("alignment")
		rows[i] = faction
	state.set("factions", rows)

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

func _faction_by_name(factions: Array, faction_name: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("name", "")) == faction_name:
			return faction
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction AI alliance shift scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction AI alliance shift scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
