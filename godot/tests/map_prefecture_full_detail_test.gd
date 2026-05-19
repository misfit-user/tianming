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

	var regions: Array = _array(game_state.get("map_regions")).duplicate(true)
	if regions.is_empty():
		_fail("No runtime map regions were loaded")
		return

	var region: Dictionary = _dict(regions[0]).duplicate(true)
	var prefectures: Array = []
	for i in range(1, 15):
		prefectures.append("Test Prefecture %02d" % i)
	region["prefectures"] = prefectures
	region["prefecture_count"] = prefectures.size()
	regions[0] = region
	game_state.set("map_regions", regions)

	var panel: Node = _find_node_with_script(main, "res://scripts/world_map_panel.gd")
	if panel == null:
		_fail("Main scene does not expose WorldMapPanel")
		return
	panel.call("set_selected_region", region)
	await get_tree().process_frame

	var visible_text: String = str(panel.call("visible_text"))
	for raw in prefectures:
		var prefecture_name: String = str(raw)
		if not visible_text.contains(prefecture_name):
			_fail("Map detail omitted prefecture from selected region: %s" % prefecture_name)
			return

	print("[TianmingGodotTest] map prefecture full-detail scene test passed")
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

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] map prefecture full-detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] map prefecture full-detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
