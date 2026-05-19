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
	var communication_tab: Node = _find_tab(tabs, "奏疏来文")
	if communication_tab == null:
		_fail("Main scene does not expose the communication tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/communication_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the communication panel")
		return
	if not panel.has_signal("communication_process_requested") or not panel.has_method("visible_text"):
		_fail("Communication panel does not expose process signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var inbox: Array = _array(game_state.call("communication_items"))
	if inbox.is_empty():
		_fail("Communication inbox was empty in main scene")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("奏疏") or not text.contains("来文"):
		_fail("Communication panel does not display memorial and letter groups")
		return

	var first_id: String = str(_dict(inbox[0]).get("id", ""))
	var pending_before: int = _array(game_state.get("pending_court_recommendations")).size()
	panel.emit_signal("communication_process_requested", first_id, "recommend")
	await get_tree().process_frame
	if _array(game_state.get("pending_court_recommendations")).size() != pending_before + 1:
		_fail("Communication UI did not route recommend action into court recommendations")
		return

	print("[TianmingGodotTest] communication UI scene test passed")
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
	print("[TianmingGodotTest] communication UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] communication UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
