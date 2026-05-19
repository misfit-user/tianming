extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const DiplomacyPanelScript := preload("res://scripts/diplomacy_panel.gd")

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
	var target_id: String = _prepare_target_faction(state)
	if target_id.is_empty():
		_fail("No targetable faction was found")
		return
	var target: Dictionary = _faction_by_id(_array(state.get("factions")), target_id)
	var result: Dictionary = state.call("issue_diplomacy_action", "send_envoy", target_id)
	if not result.get("ok", false):
		_fail("Diplomacy action failed: %s" % str(result.get("error", "")))
		return

	var panel: Control = DiplomacyPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", _array(state.get("diplomacy_actions")), _array(state.get("factions")), _array(state.get("diplomacy_history")), int(_num(state.get("action_points"))), _array(state.get("active_diplomacy_commitments")))
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("遣使修好") or not text.contains(str(target.get("name", ""))):
		_fail("Diplomacy history omitted action name or target faction")
		return
	if not text.contains("耗行动点 1"):
		_fail("Diplomacy history omitted action cost")
		return
	if not text.contains("国库银") or not text.contains("皇威"):
		_fail("Diplomacy history omitted national applied effects")
		return
	if not text.contains("势力") or not text.contains("对明关系") or not text.contains("敌意") or not text.contains("边境紧张"):
		_fail("Diplomacy history omitted faction applied effects")
		return

	print("[TianmingGodotTest] diplomacy history detail scene test passed")
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
		faction["border_tension"] = 40
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

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	print("[TianmingGodotTest] diplomacy history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
