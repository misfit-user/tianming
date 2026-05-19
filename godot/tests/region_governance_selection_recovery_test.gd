extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/region_governance_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the region governance panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_region_id: String = str(panel.get("selected_region_id"))
	if removed_region_id.is_empty():
		_fail("Region governance panel did not select an initial region")
		return

	var regions: Array = _array(game_state.get("map_regions")).duplicate(true)
	if regions.size() < 2:
		_fail("Region governance selection recovery test requires at least two regions")
		return
	var removed: bool = false
	for i in range(regions.size() - 1, -1, -1):
		var region: Dictionary = _dict(regions[i])
		if str(region.get("id", "")) == removed_region_id:
			regions.remove_at(i)
			removed = true
			break
	if not removed:
		_fail("Could not remove selected region from runtime state")
		return

	game_state.set("map_regions", regions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var recovered_region_id: String = str(panel.get("selected_region_id"))
	if recovered_region_id.is_empty() or recovered_region_id == removed_region_id:
		_fail("Region governance panel kept a stale selected region after runtime removal")
		return
	if _region_by_id(regions, recovered_region_id).is_empty():
		_fail("Region governance panel recovered to a region that is not in runtime state")
		return
	if not str(panel.call("visible_text")).contains(str(_region_by_id(regions, recovered_region_id).get("name", ""))):
		_fail("Region governance panel did not display the recovered runtime region")
		return

	print("[TianmingGodotTest] region governance selection recovery scene test passed")
	_finish(0)

func _region_by_id(regions: Array, region_id: String) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("id", "")) == region_id:
			return region
	return {}

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
	print("[TianmingGodotTest] region governance selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] region governance selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
