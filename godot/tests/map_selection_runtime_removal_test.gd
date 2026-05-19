extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/world_map_panel.gd")
	if panel == null:
		_fail("Main scene does not expose WorldMapPanel")
		return

	var selected: Dictionary = _dict(panel.get("selected_map_region"))
	var selected_id: String = str(selected.get("id", ""))
	if selected_id.is_empty():
		_fail("WorldMapPanel did not select an initial map region")
		return

	var regions: Array = _array(game_state.get("map_regions")).duplicate(true)
	var removed: bool = false
	for i in range(regions.size() - 1, -1, -1):
		var region: Dictionary = _dict(regions[i])
		if str(region.get("id", "")) == selected_id:
			regions.remove_at(i)
			removed = true
			break
	if not removed:
		_fail("Could not remove selected map region from runtime state")
		return

	game_state.set("map_regions", regions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var refreshed_selection: Dictionary = _dict(panel.get("selected_map_region"))
	if not refreshed_selection.is_empty():
		_fail("Map detail kept a stale selected region after runtime removal")
		return

	print("[TianmingGodotTest] map selection runtime removal scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	print("[TianmingGodotTest] map selection runtime removal scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] map selection runtime removal scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
