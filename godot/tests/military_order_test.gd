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
	if not state.has_method("issue_military_order"):
		_fail("GameState does not expose issue_military_order")
		return
	if _array(state.get("military_order_templates")).is_empty():
		_fail("Military order templates were not initialized")
		return

	var target_id: String = _prepare_target_region(state)
	if target_id.is_empty():
		_fail("No targetable region was found")
		return
	var target_before: Dictionary = _region_by_id(_array(state.get("map_regions")), target_id)
	var treasury_before: float = float(state.get("guoku_money"))
	var action_points_before: int = int(state.get("action_points"))

	var result: Dictionary = state.call("issue_military_order", "reinforce_garrison", target_id)
	if not result.get("ok", false):
		_fail("Military order failed: %s" % str(result.get("error", "")))
		return

	var updated: Dictionary = _region_by_id(_array(state.get("map_regions")), target_id)
	if updated.is_empty():
		_fail("Target region disappeared after military order")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Military order did not spend one action point")
		return
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("Military order did not spend treasury money")
		return
	if float(updated.get("troops", 0)) <= float(target_before.get("troops", 0)):
		_fail("Military order did not increase target troops")
		return
	if float(updated.get("army_pressure", 0)) >= float(target_before.get("army_pressure", 0)):
		_fail("Military order did not reduce target army pressure")
		return
	if _array(state.get("issued_military_orders")).is_empty():
		_fail("Military order history was not recorded")
		return

	print("[TianmingGodotTest] military order scene test passed")
	_finish(0)

func _prepare_target_region(state: RefCounted) -> String:
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	if regions.is_empty():
		return ""
	var region: Dictionary = _dict(regions[0]).duplicate(true)
	var id: String = str(region.get("id", region.get("name", "")))
	if id.is_empty():
		return ""
	region["id"] = id
	region["troops"] = 10000
	region["army_pressure"] = 40
	regions[0] = region
	state.set("map_regions", regions)
	return id

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
	print("[TianmingGodotTest] military order scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
