extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/world_map_panel.gd")
	if panel == null:
		_fail("Main scene does not expose WorldMapPanel")
		return
	if not panel.has_method("set_map_data") or not panel.has_method("select_region_by_index") or not panel.has_method("visible_text"):
		_fail("WorldMapPanel does not expose required map APIs")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null or not game_state.has_method("map_view_data"):
		_fail("Main scene did not initialize map-capable GameState")
		return
	panel.call("set_map_data", game_state.call("map_view_data"))
	panel.call("select_region_by_index", 0)
	await get_tree().process_frame

	var selected_id: String = str(panel.call("selected_region_runtime_id"))
	if selected_id.is_empty():
		_fail("WorldMapPanel did not select a runtime region")
		return
	var text: String = str(panel.call("visible_text"))
	var selected_region: Dictionary = _dict(panel.get("selected_map_region"))
	if str(selected_region.get("id", "")) != selected_id:
		_fail("WorldMapPanel selected_map_region was not synchronized with its runtime id")
		return
	if not text.contains(str(selected_region.get("name", ""))) or not text.contains("府州") or not text.contains("地块指令"):
		_fail("WorldMapPanel did not expose selected region detail text")
		return
	var world_map: Node = _find_node_with_script(panel, "res://scripts/world_map_view.gd")
	if world_map == null:
		_fail("WorldMapPanel does not contain the world map view")
		return

	print("[TianmingGodotTest] world map panel main scene test passed")
	_finish(0)

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] world map panel main scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] world map panel main scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
