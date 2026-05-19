extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/military_order_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the military order panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var target_id: String = _prepare_target_region(game_state)
	if target_id.is_empty():
		_fail("No targetable region was found")
		return
	var action_points_before: int = int(game_state.get("action_points"))

	panel.emit_signal("military_order_requested", "reinforce_garrison", target_id)
	await get_tree().process_frame

	if int(game_state.get("action_points")) != action_points_before - 1:
		_fail("Military order UI request did not spend one action point")
		return
	if _array(game_state.get("issued_military_orders")).is_empty():
		_fail("Military order UI request did not record an issued order")
		return

	print("[TianmingGodotTest] military order UI scene test passed")
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
	print("[TianmingGodotTest] military order UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] military order UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
