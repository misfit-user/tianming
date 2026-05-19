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
	if _find_tab(tabs, "势力") == null:
		_fail("Main scene does not expose the faction tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/faction_detail_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the faction detail panel")
		return
	if not panel.has_signal("faction_action_requested") or not panel.has_method("visible_text"):
		_fail("Faction detail panel does not expose action signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	if not game_state.has_method("faction_actions"):
		_fail("GameState does not expose faction actions for UI")
		return
	var faction: Dictionary = _first_faction(_array(game_state.get("factions")))
	if faction.is_empty():
		_fail("Faction UI does not have factions")
		return
	var faction_id: String = str(faction.get("id", ""))
	panel.emit_signal("faction_action_requested", faction_id, "spy_network")
	await get_tree().process_frame
	if _array(game_state.get("faction_action_history")).size() != 1:
		_fail("Faction detail UI did not route action into game state")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("势力应对") or not text.contains(str(faction.get("name", ""))):
		_fail("Faction detail panel did not display faction action result")
		return

	print("[TianmingGodotTest] faction action UI scene test passed")
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

func _first_faction(factions: Array) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if not str(faction.get("id", "")).is_empty():
			return faction
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction action UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction action UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
