extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const MilitaryOrderPanelScript := preload("res://scripts/military_order_panel.gd")

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
	var target_id: String = _prepare_target_region(state)
	if target_id.is_empty():
		_fail("No targetable region was found")
		return
	var target: Dictionary = _region_by_id(_array(state.get("map_regions")), target_id)
	var result: Dictionary = state.call("issue_military_order", "reinforce_garrison", target_id)
	if not result.get("ok", false):
		_fail("Military order failed: %s" % str(result.get("error", "")))
		return

	var panel: Control = MilitaryOrderPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_data", _array(state.get("military_order_templates")), _array(state.get("map_regions")), _array(state.get("issued_military_orders")), int(_num(state.get("action_points"))))
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("增援驻防") or not text.contains(str(target.get("name", ""))):
		_fail("Military order history omitted order name or target region")
		return
	if not text.contains("耗行动点 1"):
		_fail("Military order history omitted action cost")
		return
	if not text.contains("国库银") or not text.contains("皇威"):
		_fail("Military order history omitted national applied effects")
		return
	if not text.contains("地方") or not text.contains("兵力") or not text.contains("兵压") or not text.contains("不稳"):
		_fail("Military order history omitted regional applied effects")
		return

	print("[TianmingGodotTest] military order history detail scene test passed")
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

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	print("[TianmingGodotTest] military order history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] military order history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
