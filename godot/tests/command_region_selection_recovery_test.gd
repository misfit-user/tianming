extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var edict_panel: Node = _find_node_with_script(main, "res://scripts/edict_panel.gd")
	if edict_panel == null:
		_fail("Main scene does not expose the edict panel")
		return
	var military_panel: Node = _find_node_with_script(main, "res://scripts/military_order_panel.gd")
	if military_panel == null:
		_fail("Main scene does not expose the military order panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_region_id: String = str(edict_panel.get("selected_region_id"))
	if removed_region_id.is_empty():
		_fail("Edict panel did not select an initial target region")
		return
	military_panel.set("selected_region_id", removed_region_id)

	var regions: Array = _array(game_state.get("map_regions")).duplicate(true)
	if regions.size() < 2:
		_fail("Command region selection recovery test requires at least two regions")
		return
	var removed: bool = false
	for i in range(regions.size() - 1, -1, -1):
		var region: Dictionary = _dict(regions[i])
		if str(region.get("id", "")) == removed_region_id:
			regions.remove_at(i)
			removed = true
			break
	if not removed:
		_fail("Could not remove selected command target region from runtime state")
		return

	game_state.set("map_regions", regions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	if not _assert_recovered(edict_panel, "Edict", removed_region_id, regions):
		return
	if not _assert_recovered(military_panel, "Military order", removed_region_id, regions):
		return

	print("[TianmingGodotTest] command region selection recovery scene test passed")
	_finish(0)

func _assert_recovered(panel: Node, label: String, removed_region_id: String, regions: Array) -> bool:
	var recovered_region_id: String = str(panel.get("selected_region_id"))
	if recovered_region_id.is_empty() or recovered_region_id == removed_region_id:
		_fail("%s panel kept a stale selected region after runtime removal" % label)
		return false
	if _region_by_id(regions, recovered_region_id).is_empty():
		_fail("%s panel recovered to a region that is not in runtime state" % label)
		return false
	return true

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
	print("[TianmingGodotTest] command region selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] command region selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
