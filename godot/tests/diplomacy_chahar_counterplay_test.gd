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

	if not _has_diplomacy_action(_array(state.get("diplomacy_actions")), "support_chahar"):
		_fail("Diplomacy actions do not include support_chahar")
		return
	var chahar_id: String = str(_faction_by_name(_array(state.get("factions")), "察哈尔").get("id", ""))
	if chahar_id.is_empty():
		_fail("Chahar faction was not loaded")
		return
	_prepare_later_jin(state)
	var chahar_before: Dictionary = _faction_by_name(_array(state.get("factions")), "察哈尔")
	var treasury_before: float = float(state.get("guoku_money"))
	var result: Dictionary = state.call("issue_diplomacy_action", "support_chahar", chahar_id)
	if not result.get("ok", false):
		_fail("support_chahar diplomacy failed: %s" % str(result.get("error", "")))
		return
	var chahar_after: Dictionary = _faction_by_name(_array(state.get("factions")), "察哈尔")
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("support_chahar did not spend treasury money")
		return
	if int(chahar_after.get("relation_to_player", 0)) <= int(chahar_before.get("relation_to_player", 0)):
		_fail("support_chahar did not improve Chahar relation")
		return
	if int(chahar_after.get("military_strength", 0)) <= int(chahar_before.get("military_strength", 0)):
		_fail("support_chahar did not strengthen Chahar military capacity")
		return

	var report: Dictionary = state.call("advance_month")
	var counter: Dictionary = _find_action(_array(report.get("faction_ai_actions", [])), "chahar_counterpressure")
	if counter.is_empty():
		_fail("Supported Chahar did not create counterpressure against Later Jin")
		return
	var later_jin_after: Dictionary = _faction_by_name(_array(state.get("factions")), "后金")
	if int(later_jin_after.get("border_tension", 100)) >= 92:
		_fail("Chahar counterpressure did not reduce Later Jin border tension")
		return

	print("[TianmingGodotTest] diplomacy Chahar counterplay scene test passed")
	_finish(0)

func _prepare_later_jin(state: RefCounted) -> void:
	var rows: Array = _array(state.get("factions")).duplicate(true)
	for i in range(rows.size()):
		var faction: Dictionary = _dict(rows[i]).duplicate(true)
		if str(faction.get("name", "")) == "后金":
			faction["hostility"] = 94
			faction["border_tension"] = 92
			faction["military_strength"] = 350000
		elif str(faction.get("name", "")) == "察哈尔":
			faction["relation_to_player"] = 45
			faction["military_strength"] = 90000
			faction["cohesion"] = 52
		rows[i] = faction
	state.set("factions", rows)

func _has_diplomacy_action(actions: Array, action_id: String) -> bool:
	for raw in actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("id", "")) == action_id:
			return true
	return false

func _find_action(actions: Array, kind: String) -> Dictionary:
	for raw in actions:
		var action: Dictionary = _dict(raw)
		if str(action.get("kind", "")) == kind:
			return action
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
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy Chahar counterplay scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
