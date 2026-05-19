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
	if not state.has_method("issue_edict"):
		_fail("GameState does not expose issue_edict")
		return
	if _array(state.get("edict_templates")).is_empty():
		_fail("Edict templates were not initialized")
		return

	var target: Dictionary = _first_region_with_id(_array(state.get("map_regions")))
	if target.is_empty():
		_fail("No targetable region was found")
		return
	var target_id: String = str(target.get("id", ""))
	var treasury_before: float = float(state.get("guoku_money"))
	var action_points_before: int = int(state.get("action_points"))
	var mood_before: float = float(target.get("mood", 0))
	var unrest_before: float = float(target.get("unrest", 0))
	var tax_before: float = float(target.get("tax_pressure", 0))

	var result: Dictionary = state.call("issue_edict", "reduce_regional_levy", target_id)
	if not result.get("ok", false):
		_fail("Edict failed: %s" % str(result.get("error", "")))
		return

	var updated: Dictionary = _region_by_id(_array(state.get("map_regions")), target_id)
	if updated.is_empty():
		_fail("Target region disappeared after edict")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Edict did not spend one action point")
		return
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("Edict did not spend treasury money")
		return
	if float(updated.get("mood", 0)) <= mood_before:
		_fail("Edict did not improve target mood")
		return
	if float(updated.get("unrest", 0)) >= unrest_before:
		_fail("Edict did not reduce target unrest")
		return
	if float(updated.get("tax_pressure", 0)) >= tax_before:
		_fail("Edict did not reduce target tax pressure")
		return
	if _array(state.get("issued_edicts")).is_empty():
		_fail("Edict history was not recorded")
		return

	print("[TianmingGodotTest] edict scene test passed")
	_finish(0)

func _first_region_with_id(regions: Array) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if not str(region.get("id", "")).is_empty():
			return region
	return {}

func _region_by_id(regions: Array, id: String) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("id", "")) == id:
			return region
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] edict scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
