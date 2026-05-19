extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	if not main.has_method("issue_selected_region_edict"):
		_fail("Main scene does not expose selected-region edict actions")
		return
	if not main.has_method("issue_selected_region_military_order"):
		_fail("Main scene does not expose selected-region military actions")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var target_id: String = _prepare_target_region(game_state)
	if target_id.is_empty():
		_fail("No targetable region was found")
		return

	var world_map: Node = _find_node_with_script(main, "res://scripts/world_map_view.gd")
	if world_map == null:
		_fail("Main scene does not expose the world map view")
		return
	world_map.call("set_map_data", game_state.call("map_view_data"))
	world_map.call("select_region_by_index", 0)
	await get_tree().process_frame

	var action_points_before: int = int(game_state.get("action_points"))
	var edict_result: Dictionary = main.call("issue_selected_region_edict", "reduce_regional_levy")
	await get_tree().process_frame
	if not bool(edict_result.get("ok", false)):
		_fail("Selected-region edict failed: %s" % str(edict_result.get("error", "")))
		return
	if int(game_state.get("action_points")) != action_points_before - 1:
		_fail("Selected-region edict did not spend one action point")
		return
	if _array(game_state.get("issued_edicts")).is_empty():
		_fail("Selected-region edict did not record an issued edict")
		return
	var edict_record: Dictionary = _dict(_array(game_state.get("issued_edicts"))[-1])
	if str(edict_record.get("target_region_id", "")) != target_id:
		_fail("Selected-region edict targeted %s instead of %s" % [str(edict_record.get("target_region_id", "")), target_id])
		return

	var military_result: Dictionary = main.call("issue_selected_region_military_order", "reinforce_garrison")
	await get_tree().process_frame
	if not bool(military_result.get("ok", false)):
		_fail("Selected-region military order failed: %s" % str(military_result.get("error", "")))
		return
	if int(game_state.get("action_points")) != action_points_before - 2:
		_fail("Selected-region military order did not spend one action point")
		return
	if _array(game_state.get("issued_military_orders")).is_empty():
		_fail("Selected-region military order did not record an issued order")
		return
	var order_record: Dictionary = _dict(_array(game_state.get("issued_military_orders"))[-1])
	if str(order_record.get("target_region_id", "")) != target_id:
		_fail("Selected-region military order targeted %s instead of %s" % [str(order_record.get("target_region_id", "")), target_id])
		return

	print("[TianmingGodotTest] map region action UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

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

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] map region action UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] map region action UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
