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
	if _find_tab(tabs, "问对") == null:
		_fail("Main scene does not expose the audience tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/audience_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the audience panel")
		return
	if not panel.has_signal("audience_requested") or not panel.has_method("visible_text"):
		_fail("Audience panel does not expose audience signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var characters: Array = _array(game_state.get("characters"))
	var topics: Array = _array(game_state.call("audience_topics"))
	if characters.is_empty() or topics.is_empty():
		_fail("Audience UI does not have characters and topics")
		return
	var character_id: String = str(_dict(characters[0]).get("id", ""))
	var topic_id: String = str(_dict(topics[0]).get("id", ""))
	panel.emit_signal("audience_requested", character_id, topic_id)
	await get_tree().process_frame
	if _array(game_state.get("audience_history")).size() != 1:
		_fail("Audience UI did not route request into game state")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("问对") or not text.contains(str(_dict(characters[0]).get("name", ""))):
		_fail("Audience panel did not display audience result")
		return

	print("[TianmingGodotTest] audience UI scene test passed")
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
	print("[TianmingGodotTest] audience UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] audience UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
