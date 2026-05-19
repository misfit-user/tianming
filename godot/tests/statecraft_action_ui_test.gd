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
	if _find_tab(tabs, "变量") == null:
		_fail("Main scene does not expose the statecraft tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/statecraft_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the statecraft panel")
		return
	if not panel.has_signal("statecraft_action_requested") or not panel.has_method("visible_text"):
		_fail("Statecraft panel does not expose action signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	if not game_state.has_method("statecraft_actions"):
		_fail("GameState does not expose statecraft actions for UI")
		return
	panel.emit_signal("statecraft_action_requested", "言路通塞", "open_remonstrance")
	await get_tree().process_frame
	if _array(game_state.get("statecraft_history")).size() != 1:
		_fail("Statecraft UI did not route action into game state")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("国政态势") or not text.contains("言路通塞"):
		_fail("Statecraft panel did not display statecraft action result")
		return

	print("[TianmingGodotTest] statecraft action UI scene test passed")
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

func _fail(message: String) -> void:
	print("[TianmingGodotTest] statecraft action UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] statecraft action UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
