extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var tabs: TabContainer = _find_first_tab_container(main)
	if tabs == null:
		_fail("Main scene does not expose a gameplay tab container")
		return
	if _find_tab(tabs, "地块") == null:
		_fail("Main scene does not expose the region tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/region_governance_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the region governance panel")
		return
	if not panel.has_signal("region_governance_requested") or not panel.has_method("visible_text"):
		_fail("Region governance panel does not expose governance signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var region: Dictionary = _first_region(_array(game_state.get("map_regions")))
	if region.is_empty():
		_fail("Region UI does not have regions")
		return
	var region_id: String = str(region.get("id", ""))
	panel.emit_signal("region_governance_requested", region_id, "survey")
	await get_tree().process_frame
	if _array(game_state.get("region_governance_history")).size() != 1:
		_fail("Region governance UI did not route request into game state")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("地块治理") or not text.contains(str(region.get("name", ""))):
		_fail("Region governance panel did not display governance result")
		return

	print("[TianmingGodotTest] region governance UI scene test passed")
	_finish(0)

func _find_tab(tabs: TabContainer, tab_name: String) -> Node:
	for i in range(tabs.get_child_count()):
		var child: Node = tabs.get_child(i)
		if child.name == tab_name:
			return child
	return null

func _find_first_tab_container(root: Node) -> TabContainer:
	if root is TabContainer:
		return root as TabContainer
	for child in root.get_children():
		var found: TabContainer = _find_first_tab_container(child)
		if found != null:
			return found
	return null

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _first_region(regions: Array) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if not str(region.get("id", "")).is_empty():
			return region
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] region governance UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] region governance UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
