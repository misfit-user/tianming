extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const EdictPanelScript := preload("res://scripts/edict_panel.gd")

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

	var target: Dictionary = _first_region_with_id(_array(state.get("map_regions")))
	if target.is_empty():
		_fail("No targetable region was found")
		return
	var result: Dictionary = state.call("issue_edict", "reduce_regional_levy", str(target.get("id", "")))
	if not result.get("ok", false):
		_fail("Edict failed: %s" % str(result.get("error", "")))
		return

	var panel: Control = EdictPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", _array(state.get("edict_templates")), _array(state.get("map_regions")), _array(state.get("issued_edicts")), int(_num(state.get("action_points"))))
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("减派蠲税") or not text.contains(str(target.get("name", ""))):
		_fail("Edict history omitted edict name or target region")
		return
	if not text.contains("耗行动点 1"):
		_fail("Edict history omitted action cost")
		return
	if not text.contains("国库银") or not text.contains("民心"):
		_fail("Edict history omitted national applied effects")
		return
	if not text.contains("地方") or not text.contains("民心") or not text.contains("不稳") or not text.contains("税压"):
		_fail("Edict history omitted regional applied effects")
		return

	print("[TianmingGodotTest] edict history detail scene test passed")
	_finish(0)

func _first_region_with_id(regions: Array) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if not str(region.get("id", "")).is_empty():
			return region
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
	print("[TianmingGodotTest] edict history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] edict history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
