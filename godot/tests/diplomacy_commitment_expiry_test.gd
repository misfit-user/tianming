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

	if not _array(state.get("active_diplomacy_commitments")).is_empty():
		_fail("Diplomacy commitments should start empty")
		return

	_prepare_later_jin_and_chahar(state)
	var chahar_id: String = str(_faction_by_name(_array(state.get("factions")), "察哈尔").get("id", ""))
	var result: Dictionary = state.call("issue_diplomacy_action", "support_chahar", chahar_id)
	if not result.get("ok", false):
		_fail("support_chahar diplomacy failed: %s" % str(result.get("error", "")))
		return

	var commitments: Array = _array(state.get("active_diplomacy_commitments"))
	if commitments.size() != 1:
		_fail("support_chahar did not create exactly one active diplomacy commitment")
		return
	var commitment: Dictionary = _dict(commitments[0])
	if str(commitment.get("id", "")) != "support_chahar" or int(commitment.get("remaining_months", 0)) != 2:
		_fail("support_chahar commitment has wrong id or duration")
		return

	var first_report: Dictionary = state.call("advance_month")
	if _find_action(_array(first_report.get("faction_ai_actions", [])), "chahar_counterpressure").is_empty():
		_fail("Active support_chahar commitment did not create first-month Chahar counterpressure")
		return
	if int(_dict(_array(state.get("active_diplomacy_commitments"))[0]).get("remaining_months", 0)) != 1:
		_fail("Diplomacy commitment did not tick down after first month")
		return

	var second_report: Dictionary = state.call("advance_month")
	if _find_action(_array(second_report.get("faction_ai_actions", [])), "chahar_counterpressure").is_empty():
		_fail("Active support_chahar commitment did not create second-month Chahar counterpressure")
		return
	if not _array(state.get("active_diplomacy_commitments")).is_empty():
		_fail("Diplomacy commitment did not expire after its duration")
		return

	var third_report: Dictionary = state.call("advance_month")
	if not _find_action(_array(third_report.get("faction_ai_actions", [])), "chahar_counterpressure").is_empty():
		_fail("Expired support_chahar commitment still created Chahar counterpressure")
		return

	print("[TianmingGodotTest] diplomacy commitment expiry scene test passed")
	_finish(0)

func _prepare_later_jin_and_chahar(state: RefCounted) -> void:
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
			faction.erase("ming_support")
		rows[i] = faction
	state.set("factions", rows)

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
	print("[TianmingGodotTest] diplomacy commitment expiry scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
