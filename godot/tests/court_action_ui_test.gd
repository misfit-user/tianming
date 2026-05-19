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
	if _find_tab(tabs, "行动") == null:
		_fail("Main scene does not expose the court action tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/court_action_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the court action panel")
		return
	if not panel.has_signal("action_requested") or not panel.has_method("visible_text"):
		_fail("Court action panel does not expose action signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var actions: Array = _array(game_state.get("player_actions"))
	if actions.is_empty():
		_fail("Court action UI has no player actions")
		return
	var action: Dictionary = _dict(actions[0])
	var action_id: String = str(action.get("id", ""))
	var action_name: String = str(action.get("name", action_id))
	var history_before: int = _array(game_state.get("action_history")).size()
	var points_before: int = int(game_state.get("action_points"))
	panel.emit_signal("action_requested", action_id)
	await get_tree().process_frame
	if _array(game_state.get("action_history")).size() != history_before + 1:
		_fail("Court action UI did not route request into game state history")
		return
	if int(game_state.get("action_points")) >= points_before:
		_fail("Court action UI did not spend action points")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains(action_name):
		_fail("Court action panel visible_text did not include the issued action")
		return

	print("[TianmingGodotTest] court action UI scene test passed")
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

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court action UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court action UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
